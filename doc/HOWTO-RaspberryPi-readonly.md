# Using Raspberry PI for monitoring - readonly filesystem, Docker nad Grafolean

We could follow the same installation procedure to have a functioning Grafolean install on a Raspberry Pi, however, SD cards are known to be problematic when it comes to wear, or when accidental power loss occurs during write operations. This problem can be alleviated by using an UPS and external storage (e.g. SSD disk in USB enclosure), but this means more hardware is needed.

This guide will present another solution. Raspberry Pi will be read-only and will use memory (`tmpfs`) for anything that is changing during normal operation of the system. Persistent data will _not_ be saved on device; instead, values will be posted to online service at https://grafolean.com/. Alternatively, if you have an SSD disk lying around, you could also use it to save the data.

Following an excellent guide on how to make your RPi readonly:

https://medium.com/swlh/make-your-raspberry-pi-file-system-read-only-raspbian-buster-c558694de79

Before running the changes below, make sure you are in not in read-only mode (run `rw`).

### Improvements on the read-only guide

First, let's disable filesystem check for `/` and `/boot` - since both are readonly, we don't expect many filesystem errors to occur. We do this by changing the last numbers in each line to `0`:
```
PARTUUID=7f58cf5f-01  /boot           vfat    defaults,ro          0       0
PARTUUID=7f58cf5f-02  /               ext4    defaults,noatime,ro  0       0
```

Then we need to make sure that `/tmp` is writeable by anyone, as it is in normal setup (but only owner can change its permissions). In `/etc/fstab/`, we change the `/tmp` line to read:
```
tmpfs        /tmp            tmpfs   mode=1777,nosuid,nodev         0       0
```

Still, if we check, we will notice that `/tmp` directory has invalid permissions after boot. The reason is that OS [overrides /var/spool permissions](https://unix.stackexchange.com/a/491005), which in our case is linked to `/tmp`. To fix this we simply mount `/var/spool` on a separate `tmpfs`:
```
# rm /var/spool
# mkdir -m 755 /var/spool
# echo 'tmpfs  /var/spool  tmpfs  defaults,noatime,nosuid,nodev,noexec,mode=0755,size=64M  0  0' >> /etc/fstab
```

### Docker

First steps first:
```
# apt install docker.io
```

Docker is changing many things within `/var/lib/docker` and won't start if this directory is mounted read-only. So as a first step, we mount it on `tmpfs`:
```
# systemctl stop docker
# systemctl disable docker
# echo 'tmpfs  /var/lib/docker  tmpfs  defaults,noatime,nosuid,nodev,mode=0711  0  0' >> /etc/fstab
```

If we start docker now, it will work as it should. There are just two problems:
- any image that we pull from registry will not be persisted and will need to be re-downloaded after each reboot, and
- we are wasting memory, since the images are saved into RAM instead of on SD card now.

Since containers are created after reboot, we can't really do much about them; they need to be put on `tmpfs`. On the other hand images can be saved to persistent memory.

If we take a look at the contents of `/var/lib/docker/`, we see `overlay2/` subdirectory, which contains "layers" for both images and containers. The directory itself needs to be mounted on `tmpfs`, otherwise we would not be able to start containers (which create new entries here). However, what we can do is to move those entries that correspond to images to persistent storage and just link there.

A few notes about the solution below:
- any changes need to be explicitly saved to persistent storage, otherwise they will be removed when Docker service restarts (even just stopping and starting docker service will revert to stored images)

WARNING: this part depends on internal Docker filesystem hierarchy. I do _not_ know how stable this is and if it a good idea to do this; it works for my use case but might fail in future versions. However, even if it fails, at worst the images will still be in RAM instead of on persistent storage, so the damage should be small.


#### Step 1: script for saving existing Docker config to a persistent dir

This script should be saved to `/usr/local/bin/dockersave.sh`:
```bash
#!/bin/bash
set -e
PERSIST_DIR="/var/lib/docker.persist"

# make sure docker is NOT running:
systemctl is-active -q docker && (echo "Docker service must NOT be running, please stop it first!"; exit 1)
# containers need to be writeable, so we don't allow saving when they exist either:
[ `ls /var/lib/docker/containers/ | wc -l` -eq 0 ] || (echo "We can't save Docker configuration with containers; remove them first!"; exit 1)

[ -d "$PERSIST_DIR" ] || mkdir -m 700 "$PERSIST_DIR"

# copy from tmpfs to persistent storage:
# but be careful when copying overlay/ - it might contain links to the eprsistent storage, which we must simply leave there:
for subdir in `ls "/var/lib/docker/"`
do
  if [ "overlay2" != "$subdir" ]
  then
    rm -rf "$PERSIST_DIR/$subdir"
    cp -ra "/var/lib/docker/$subdir" "$PERSIST_DIR/$subdir"
  else
    # remove all links beecause we don't want to overwrite the persistent storage with them:
    find "/var/lib/docker/overlay2/" -maxdepth 1 -type l -exec rm '{}' ';'
    # and overlay2/l/ will be copied verbatim, so remove it in persistent storage:
    rm -rf "$PERSIST_DIR/overlay2/l"
    # everything else is copied over to persistent storage: (l/ and any new image overlays)
    cp -ra /var/lib/docker/overlay2/* "$PERSIST_DIR/overlay2/"
  fi
done
```

Don't forget to make it executable:
```
# chmod +x /usr/local/bin/dockersave.sh
```

#### Step 2: populate /var/lib/docker from persistent storage when docker starts

Now, we just need to make sure that Docker will actually see those images when it starts.

This script should be saved to `/usr/local/bin/systemctl.dockerload.sh`:
```bash
#!/bin/bash
set -e
PERSIST_DIR="/var/lib/docker.persist"

# make sure docker is NOT running:
systemctl is-active -q docker && (echo "Docker service must NOT be running, please stop it first!"; exit 1)

if [ ! -d "$PERSIST_DIR" ]
then
  echo "Docker configuration was never saved yet (dockersave.sh), nothing to load. Exiting."
  exit 0
fi

# existing directory structure should be copied verbatim, except for overlay2/ (but
# only on top level - image/overlay2 should be copied)
/bin/rm -rf /var/lib/docker/*
for subdir in `ls "$PERSIST_DIR/"`
do
  if [ "overlay2" != "$subdir" ]
  then
    cp -ra "$PERSIST_DIR/$subdir" "/var/lib/docker/$subdir"
  fi
done

# overlay2/ must be read-write, but the existing subdirectories can be links to a
# persistent (readonly) location:
mkdir -m 700 /var/lib/docker/overlay2
for layer_hash in `ls $PERSIST_DIR/overlay2 | grep -v "^l$"`
do
  ln -s "$PERSIST_DIR/overlay2/$layer_hash" "/var/lib/docker/overlay2/$layer_hash"
done
cp -ra "$PERSIST_DIR/overlay2/l" "/var/lib/docker/overlay2/l"
```

Make it executable:
```
# chmod +x /usr/local/bin/systemctl.dockerload.sh
```

Then change `/lib/systemd/system/docker.service` to include:
```
ExecStartPre=/usr/local/bin/systemctl.dockerload.sh
```

And run:
```
# systemctl daemon-reload
```

### How to use this

You can use Docker as you would normally. After each service restart (on reboot or manually), all the images will be reset. If you want to add all pulled images to persistent storage, simply do:
```
# docker ps -a
(and remove any containers)
# systemctl stop docker
# rw
# dockersave.sh
# ro
```

Next time the Docker starts, it will have the images at its disposal.

