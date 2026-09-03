Created by 马勇, last modified by  许中立 on 一月 30, 2024

## 1. Overview（概述）

yfsminer 是专门用于解析 YFS 元数据的工具，目前设计目标是面向研究院内部使用，主要用途是检查 YFS 元数据，辅助 YFS 故障、bug 分析。

## 2. Features（功能特性）

- 目前 yfsminer 支持解析以下类型数据：
    - disk header
    - disk partner
    - disk bitmap
    - file ctrl
    - 间接 fat
    - dir ctrl
    - redo（暂不支持）
- yfsminer 支持一些参数
-b, block id，value-d, disk path， string-f,   fd， value-g,  diskgroup id， value-s,   block size， value-S,  au size, value-t,   block type, string, 可选以下：        - diskheader : disk header block, size=4K
        - pst : disk patner block, size=4K
        - bitmap : disk bitmap block, size=au_size
        - fctrl : file ctrl block， size=4K
        - indirfctrl : indirect file ctrl block, size=4K
        - redo : redo file, size=8 * au_size
-u,  au id, value-v,  verbose 啰嗦模式-y,  ycr 盘路径，string-h,  显示帮助

  


yfscmd 在标准输出做了着色，这些特殊字符在 CI 中不太友好，看起来像乱码。

yfsminer 做了一些改进，当标准输出被重定向到非 tty 类型，比如一个文件或管道，那些看起来像乱码的着色字符就不再输出了，方便测试同学使用。 

## 3. Interfaces（接口）

## 4. Limitations（功能限制）

当 yfsminer 试图自动识别数据时，有可能 core，内部工具，暂时无需处理次类 core。

## 5. Detail Design（详细设计）

图中 “需要参数” 中带 “*” 的参数表示有默认值或  yfsminer 可以自动从数据的 header 中获取。

![](https://pingcode.yasdb.com/atlas/files/public/67396ad58970c2af4f51ff84/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTMwNzYsImV4cCI6MTc4MjIyMzg3Nn0.8xhXP-2XT3XiwG_uZt6BczFAWS77BMrQDHRUM4MqZRE)

yfsminer 的基本逻辑如图所示，可以通过不同的参数组合，指定不同的数据来源：

- YCR 盘，解析 YFS 元数据，包括 DiskGroups、FailurGroups、Disks 等信息。只需通过 -y 指定 YCR 盘的路径。
- 磁盘上的 block，支持 Features 中列出的所有 block 类型。
    - 如果只指定 disk，那么会打印磁盘所有的元数据，即： disk header、disk partner、bitmap
    - 否则，需指定 disk(-d) 、au(-u)、block(-b，默认 0)、auSize(-S)、blockSize(-s， 默认 4K)、blockType(-t，默认从 blockHeader 探测)
- 文件中的 block，支持 file ctrl、dir ctrl、redo 等。需指定 dg(-g)、fd(-f)、block(-b, 默认 0)、blockSize(-s, 默认 4K)、blockType(-t, 默认从 blockHeader探测)。


注意：

如果要从文件获取虚拟元数据，应确保 yfssrv 或 yascs 已启动，且 yfsminer 可以获得正确的 $YASCS_HOME 环境变量。

所有虚拟元文件的 block 都可以直接从磁盘获取，获得相同的输出。

  


yfsminer 的数据流： 读取block→解析block。

  


其中 blockType(-t)  可以由 yfsminer 自动探测，有时候 YFS 数据已经出错，那么可以通过 -t 强制决定 block 按该数据类型解释。

## 6. Testcases（用例）

如采用这些用例，请将 au size 设置为 1M， 2 副本，仅在 DG 目录创建 1 个文件，并 truncate 为 1G。

否则可能某些参数会发生变化，请联系我调整。

[ ] 里的选项表示可选，有没有的结果都是一样的，请注意不要直接粘贴。

如果数据错误，yfsminer 会对部分关键数据错误输出红色提示。

|用例|说明|
|---|---|
|yfsminer -V|版本|
|yfsminer -h|帮助|
|yfsminer -y /ycr/path|YFS diskgroup\failuregroup\disk 属性清单|
|yfsminer -d /yfs/disk|YFS 数据磁盘的元数据, 包括 disk header、pst、bitmap|
|yfsminer -d /yfs/disk -S au_size [-s 4K] -u 3 -b 1 [-t fctrl]|从数据盘解析 1 号文件 （superFile） 的ctrl 信息。|
|yfsminer -d /yfs/disk -S au_size [-s 4K] -u 5 -b 0 [-t fctrl]|从数据盘解析 256 号文件 (用户自建文件) 的ctrl 信息，可以看到属性中 fd=256, size=1073741824, extents 已经用到 61. 其中60、61 是同一间接 AU的 2 个副本，保存着一些相同的 indirect fctrl|
|yfsminer -d /yfs/disk -S au_size [-s 4K] -u 44 -b 0 [-t indir]|从数据盘解析 256 号文件的第一个间接 AU 上的 0 号 indirect fctrl，共有 480 个 extents|
|yfsminer -g 0 -f 1 [-s 4K] -b 256 [-t indir]|从 superFile 中解析第 256 号文件的 ctrl 信息，应与 “yfsminer -d /yfs/disk -S au_size [-s 4K] -u 5 -b 0 [-t fctrl]” 结果相同。|
|yfsminer -g 0 -f 2 [-s 4K] [ -b 0 ] [ -t redo]|解析 2  号文件（redo）的信息。|
|yfsminer -g 0 -f 3 [-s 4K] [ -b 0 ] [ -t dir]|从 3 号文件 (dir) 解析用户自建的第一个文件的目录信息，可以看到 name 属性为用户自建文件名称， flag.isFile = 1, [fd|subDirBlkId] = 256|


###   [显示版本](#显示版本)  

```
$ yfsminer -V
yfsminer Debug 23.1.0.2 x86_64 3c883d3

```

###   [显示帮助](#显示帮助)  

```
$ yfsminer -h
yfsminer Debug 23.1.0.2 x86_64 3c883d3

Usage 1: yfsminer -y /ycr/disk
   Parse YFS metadata on YCR disk

Usage 2: yfsminer -d /yfs/disk
   Parse ALL disk metadata

Usage 3: yfsminer -d yfs_disk_path -S au_size [-s block_size] [-u au_id] [-b block_id] [-t block_type]
   Parse disk block
   yfs_disk_path : the disk path, must be managed by YFS
   au_size       : allocate unit size
   block_size    : block size, optional, default 4K (optional)
   au_id         : au id, default 0                 (optional)
   block_id      : block id, default 0              (optional)
   block_type    : block type, default auto detect  (optional)

Usage 4: yfsminer -g dg_id -f fd [-s block_size] [-b block_id] [-t block_type]
   Parse disk block
   dg_id         : disk group id
   fd            : file discriptor id
   block_size    : block size, optional, default 4K (optional)
   block_id      : block id, default 0              (optional)
   block_type    : block type, default auto detect  (optional)

Valid block_type: 
   diskheader    : disk header block, size=4K
   pst           : disk patner block, size=4K
   bitmap        : disk bitmap block, size=au_size
   fctrl         : file ctrl block
   indirfctrl    : indirect file ctrl block, size=4K
   redo          : redo file, size=8 * au_size

```

###   [解析 YFS 元数据](#解析-yfs-元数据)  

```
$ yfsminer -y /dev/sde
readDisk(/dev/sde, offset = 2719744, size = 34865152)
read block OK. 
magicNumber: ea97d32057bfeda2

DiskGroups = {
 [0]: {used=1, name=DG_0    , redundancy=1 , ausize=1048576 , flags=3}
 [1]: {used=0, name=        , redundancy=0 , ausize=0       , flags=0}
   &lt;510 times&gt;
}
&gt;&gt;&gt; 512 DiskGroups.

FailureGroups = {
 [0]: {used=1, name=FG0     , dgId=0 , reserved=0}
 [1]: {used=1, name=DG_0_0  , dgId=0 , reserved=0}
 [2]: {used=0, name=        , dgId=0 , reserved=0}
   &lt;2045 times&gt;
}
&gt;&gt;&gt; 2048 FailureGroups.

Disks = {
 [0]: {used=1, name=DG_0_0  , path=/dev/sdb    , fgId=0   , interId=   0,  ausize=1048576 , aucount=102400  }
 [1]: {used=1, name=DG_0_0  , path=/dev/sdc    , fgId=1   , interId=   1,  ausize=1048576 , aucount=102400  }
 [2]: {used=0, name=        , path=            , fgId=0   , interId=   0,  ausize=0       , aucount=0       }
   &lt;65532 times&gt;
}
&gt;&gt;&gt; 65535 Disks.
SUCCESS

```

yfsminer 会自动缩略那些重复元素，比如     `<510 times>`     表示上一行还出现了 510 次，总共 510 + 1 次相同的数据。

可以通过     `-v`     以啰嗦模式输出完整结果。

###   [解析 Disk 元数据](#解析-disk-元数据)  

如果只指定 Disk 路径（但必须是 YFS 管理的磁盘），会打印所有 Disk 元数据：

- disk head
- disk partner
- disk bitmap


```
$ yfsminer -d /dev/sdb 
readDisk(/dev/sdb, offset = 0, size = 512)
read block OK. 
DISK_HEAD = {
  head = {
    checksum = 0 [0x0]
    changeNum = 0
    latch
    blockId = 0
    lsn = 0
    [block size does not match, expecting: 512]
    blockSize = 4096
    type = 1[BLOCK_DISK_HEADER]
    unused[7]
  }
 interId = 0
 name = DG_0_0
 path = /dev/sdb
 fgId = 0
 dgId = 0
 fgName = FG0
 dgName = DG_0
 redundancy = 0
 diskStatus = 1
 auSize = 1048576
 auCount = 102400
 bitmapAuCnt = 1
 bootAu = 3
 createTime = 1689750049829597 [2023-07-19 07:00:49]
 failTime = 0 [1970-01-01 12:00:00]
 repairTime = 0 [1970-01-01 12:00:00]
}

readDisk(/dev/sdb, offset = 1048576, size = 4096)
read block OK. 

PST = {
  head = {
    checksum = 3432143130 [0xCC92591A]
    changeNum = 0
    latch
    blockId = 0
    lsn = 0
    [block size does not match, expecting: 512]
    blockSize = 4096
    type = 2[BLOCK_PARTNER_SHIP]
    unused[7]
  }
 parnterCnt = 1
 partners = [1, ]
}

readDisk(/dev/sdb, offset = 2097152, size = 1048576)
read block OK. 

BITMAP = {
  head = {
    checksum = 2367810541 [0x8D21EBED]
    changeNum = 4
    latch
    blockId = 0
    lsn = 1
    blockSize = 1048576
    type = 3[BLOCK_BITMAP]
    unused[7]
  }
 firstAu = 3
 freeBegin = 3
 freeCnt = 8388117
 map = {
[0       ]: 11100000 11111111 00000000 00000000 00000000 00000000 00000000 00000000 
[64      ]: 00000000 00000000 00000000 00000000 00000000 00000000 00000000 00000000 
   &lt;131062 times&gt;
[8388096 ]: 00000000 00000000 00000000 00000000 
 }
}
SUCCESS

```

###   [解析磁盘的 block](#解析磁盘的-block)  

可以指定更多参数，从 Disk 读取 block 并解析。

YFS 的 1 号文件是超级虚拟元文件，其 ctrl 信息通常在磁盘的 au 3， block 1， 可以通过下面的指令单独解析该 block。

```
$ yfsminer -d /dev/sdb -S 1M -s 4K -u 3 -b 1
type not set, auto detect.
readDisk(/dev/sdb, offset = 3149824, size = 4096)
read block OK. 
checksum match.
 **********************************
  head = {
    checksum = 4209414680 [0xFAE69218]
    changeNum = 3
    latch
    blockId = 1
    lsn = 4
    blockSize = 4096
    type = 4[BLOCK_FILE]
    unused[7]
  }
 fileCtrl = {
 fd = 1
 size = 1056768
 auCnt = 4
 dataCpyCnt = 2
 metaCpyCnt = 2
 createTime = 1689750049841514 [2023-07-19 07:00:49]
 deleteTime = 0 [1970-01-01 12:00:00]
 strpwdth = 0
 redundancy = 1
 used = 1
 reserve[1]
 }
 extends = [
 [0  ]: 18446462598732840963 {disk=0, unit=3, chk=255[0xFF], flag=255[0xFF]}
 [1  ]: 18446462603027808259 {disk=1, unit=3, chk=255[0xFF], flag=255[0xFF]}
 [2  ]: 18446462598732840965 {disk=0, unit=5, chk=255[0xFF], flag=255[0xFF]}
 [3  ]: 18446462603027808261 {disk=1, unit=5, chk=255[0xFF], flag=255[0xFF]}
 [4  ]: 18446744073709551615 {disk=65535, unit=4294967295, chk=255[0xFF], flag=255[0xFF]}
   &lt;355 times&gt;
 ]
&gt;&gt;&gt; 360 EXTs
SUCCESS

```

参数解释：

-S 1M， au size 1M-s 4K, blockSize 4K, 默认值也是 4K，可以不设置该值-u 3, au 3-b 1, block 1- 这里没有明确指定 blockType，yfsminer 会自动探测 block 类型，也可以明确指定类型     `-t fctrl`    。


###   [解析虚拟元文件的 block](#解析虚拟元文件的-block)  

**依赖 yfssrv 或 yascs，确保它们之一已启动**

YFS 的 1 号文件本身也保存了所有文件的 ctrl 信息，包括其自身的 ctrl 信息，在 1 号文件的 block 1，通过下面的指令从 1 号文件解析该 block。

```
$ yfsminer -g 0 -f 1 -s 4K -b 1
block size not set, default 4K.
type not set, auto detect.
yfsHome=/home/mayong/YASDB_NODE/node0
checksum match.
 **********************************
  head = {
    checksum = 4209414680 [0xFAE69218]
    changeNum = 3
    latch
    blockId = 1
    lsn = 4
    blockSize = 4096
    type = 4[BLOCK_FILE]
    unused[7]
  }
 fileCtrl = {
 fd = 1
 size = 1056768
 auCnt = 4
 dataCpyCnt = 2
 metaCpyCnt = 2
 createTime = 1689750049841514 [2023-07-19 07:00:49]
 deleteTime = 0 [1970-01-01 12:00:00]
 strpwdth = 0
 redundancy = 1
 used = 1
 reserve[1]
 }
 extends = [
 [0  ]: 18446462598732840963 {disk=0, unit=3, chk=255[0xFF], flag=255[0xFF]}
 [1  ]: 18446462603027808259 {disk=1, unit=3, chk=255[0xFF], flag=255[0xFF]}
 [2  ]: 18446462598732840965 {disk=0, unit=5, chk=255[0xFF], flag=255[0xFF]}
 [3  ]: 18446462603027808261 {disk=1, unit=5, chk=255[0xFF], flag=255[0xFF]}
 [4  ]: 18446744073709551615 {disk=65535, unit=4294967295, chk=255[0xFF], flag=255[0xFF]}
   &lt;355 times&gt;
 ]
&gt;&gt;&gt; 360 EXTs
SUCCESS

```

得到的结果与直接从磁盘解析该 block 一样。

参数解释：

-g 0, diskGroup 0-f 1, Fd 1-s 4K, blockSize 4K, 默认值也是 4K，可以不设置该值-b 1， block 1- 同样的，也可以明确指定类型     `-t fctrl`    。


###   [啰嗦模式 Verbose](#啰嗦模式-verbose)  

如果输出结果有缩略，可以指定     `-v`     启用罗嗦模式，输出完整结果。

  


## 7. Workload（工作量）

## 8. TODO（遗留问题）

暂不支持 freeList 解析， freeList 位于 1 号文件 block 0。

  


  


## Attachments: