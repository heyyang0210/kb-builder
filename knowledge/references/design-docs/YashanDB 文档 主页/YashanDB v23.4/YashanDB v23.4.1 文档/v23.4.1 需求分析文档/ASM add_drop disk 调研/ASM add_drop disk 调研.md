Created by 马勇, last modified on 四月 07, 2024

#   [1. 加减盘方式](#1-加减盘方式)  

ASM 中通过路径加盘；通过 disk name 减盘。

会立即触发 rebalancing 操作，可以同步或异步。

#   [2. rebalance](#2-rebalance)  

增减盘都会触发 ASM 执行 rebalance。

  `alter diskgroup`     操作默认情况（相当于     `rebalance nowait`    ）下无需等待 rebalance 结束。通过     `V$ASM_OPERATION`     视图可以监控 rebalance 进度。

可以通过     `rebalance wait`     语句指定同步     `alter diskgroup`     操作，rebalance 完成后才返回。

同步 rebalance 可以被     `Ctrl+C`     中断，转为异步     `rebalance`    ，但不会取消     `alter diskgroup`     操作结果。

rebalance 强度通过     `rebalance power`     控制执行强度。

#   [3. alter diskgroup](#3-alter-diskgroup)  

目前 ASM 支持以下 diskgroup 操作：

- adding 【YFS支持】
- replacing
- renaming
- dropping
- resizing
- undropping
- 设置 rebalance power


```
ALTER DISKGROUP data1 ADD DISK '/devices/diska*';

```

```
# 这样的好处是可以保证 drop disk 时 rebalance 可以检查剩余空间，确保 drop 成功。
ALTER DISKGROUP data2 REPLACE DISK diskc7 WITH '/devices/diskc18' POWER 3;

```

```
ALTER DISKGROUP fra2 RENAME DISK 'FRA1_0001' TO 'FRA2_0001', 'FRA1_0002' TO 'FRA2_0002';

```

```
# drop disk
ALTER DISKGROUP data1 DROP DISK diska5;
# drop all disks in failgroup
ALTER DISKGROUP DROP DISKS IN FAILGROUP fg;

```

```
# all the disk must be of equal size, so we have to resize all disk in once.
ALTER DISKGROUP data1 RESIZE ALL SIZE 100G;

```

```
# cancel all pending dropping disk operations.
ALTER DISKGROUP data1 UNDROP DISKS;

```

```
# set to 10
ALTER DISKGROUP data2 REBALANCE MODIFY POWER 10;
# set to default
ALTER DISKGROUP data2 REBALANCE MODIFY POWER;


```

以上大多数操作都可以一次执行，例如：

```
ALTER DISKGROUP data1 DROP DISK diska5
     ADD FAILGROUP failgrp1 DISK '/devices/diska9' NAME diska9;

```

（单纯的 drop disk 引起的再平衡比较复杂，建议优先搞换盘和加盘）

#   [4. 一些技术点](#4-一些技术点)  

- 除 external 冗余外，ASM 支持在线无损 drop disk，数据会自动迁移到其他磁盘，再 drop disk。
- offline 和 drop？单副本下，如果磁盘故障了，那么整个 diskgroup 都会 dismount。多副本下，如果 disk 故障，该 disk 标记为 offline，在 repair 时间内未修复的，则将该 disk drop。Oracle 10 以前，如果 dg 内有 disk 故障，则会 dismount 整个 dg，11 及以后版本才改为 offline + repair time。（offline 磁盘上的数据如何读写更新）
- 识别故障磁盘：ASM 将无法读 or 写的 disk 标记为故障。
- 故障 disk 的 rebalance 牵扯到多次故障，处理方式与各故障 disk 所在 fg 有关，情况会变得复杂。


#   [5. rebalancing 的实现难点](#5-rebalancing-的实现难点)  

YFS 目前支持离线 rebalancing 比较现实，ASM 的 DB 业务和存储为同一服务，可以方便的处理 IO 和 rebalancing。 YFS 目前无法控制或高效的感知 DB 的 IO 行为，暂时没有想到性能代价合理的在线 rebalancing 方法。

一种可以考虑的方式是引入文件读写权限控制：

- 逐一将涉及再平衡的文件设置为只读，迁移文件数据，完成平衡后再设置为读写。


#   [6. rebalancing 的意义](#6-rebalancing-的意义)  

- 支持在线 drop 有数据的 disk。
- 方便的进行 disk replacing。
- 可以实现 disk usage percentage 均衡，提升系统总体读性能。


#   [7. 待明确的点](#7-待明确的点)  

1. 目前已支持加盘，但加盘后磁盘空间依然保持顺序分配，无法与 Oracle 一样再平衡，提升系统 IO 带宽。加盘时除对 DG、FG 调整实现扩容外，是否需支持再平衡、调整 YFS ext 分配策略(可以改)。
1. 由于没有再平衡机制，减盘时依然要求所有 dg disk 数量一致，这会使得 drop disk 语法与 Oracle 有较大差异，例如 2 种方法：


- YFS 的伙伴关系是唯一的，仅指定一个 disk，所有伙伴 disk 全部 drop
- 取消该限制，但会让磁盘空间管理变复杂，且必须支持 rebalancing。


1. 现有框架直接支持减盘，考虑有 2 种思路：


- 约束仅能减空盘，实际业务中可能无法删盘，因为用户无法控制数据保存的位置，需要drop disk 的时候可能是磁盘损坏等情况，需要换盘。
- 仅支持 replace，将旧盘上的数据迁移到新盘，比实现再平衡简单一些。


1. 是否支持在线减盘，如欲支持在线减盘，可能需要引入文件读写控制或严格的磁盘约束，如使用锁，则需要解决 YFS 客户端和服务端的并发问题。
1. YFS 执行业务时，尤其是 IO 业务中检查磁盘状态、文件状态，以便后续支持 disk offline、文件只读等功能，但由于 IO 调用十分频繁，这会引入相当的性能开销。
1. 单副本时，drop disk 则 dismount dg，或者不允许 drop disk？


#   [8. YFS 的冗余机制介绍](#8-yfs-的冗余机制介绍)  

Oracle 通过均衡机制，可以实现数据无损和可靠性无损的加减盘。YFS 目前不支持再平衡，这里暂时不考虑未进行数据牵引起的数据丢失。

![](https://pingcode.yasdb.com/atlas/files/public/6739da55a1ad9a3311de1115/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFJQUNBQUFBQkFBQUFBQUFBQUFBQUNBQWdBQUFBQUFBQUFBQ0NBQUFBQUFBQUFBUUVBQUFJQUFBQUFBQUFBQUFBQUFBQUFBSUFDQUFBQUFBQWdBQUFBQUFCQUFBQUFBSUFBQ0FnQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQkFBQUFnQUFBUUFBQUFBQUFBQUFnQUFBQUFBQUFBQ2dBQUFBQUFBQWdBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYxNTQsImV4cCI6MTc4MjQ2Njk1NH0.X-vnA-S8SqI_xYwtj4SCr5Wc-vpdCk6hOZqUwwOKqxQ)

以 3 fg， 2 副本为例。YFS 的磁盘分配策略要求所有 disk 大小相同，伙伴磁盘按副本数配对，那些无法配对的 disk 空间实际上不会被使用。

![](https://pingcode.yasdb.com/atlas/files/public/6739da55a1ad9a3311de1116/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFJQUNBQUFBQkFBQUFBQUFBQUFBQUNBQWdBQUFBQUFBQUFBQ0NBQUFBQUFBQUFBUUVBQUFJQUFBQUFBQUFBQUFBQUFBQUFBSUFDQUFBQUFBQWdBQUFBQUFCQUFBQUFBSUFBQ0FnQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQkFBQUFnQUFBUUFBQUFBQUFBQUFnQUFBQUFBQUFBQ2dBQUFBQUFBQWdBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYxNTQsImV4cCI6MTc4MjQ2Njk1NH0.X-vnA-S8SqI_xYwtj4SCr5Wc-vpdCk6hOZqUwwOKqxQ)

对于伙伴磁盘有富余的情况，drop 一个 disk，那么剩余 disk 会与未使用的disk 组成冗余，依然可以保证 dg 的冗余度，但这里需要先将 disk03 的数据迁移到 disk05。

![](https://pingcode.yasdb.com/atlas/files/public/6739da55a1ad9a3311de1117/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFJQUNBQUFBQkFBQUFBQUFBQUFBQUNBQWdBQUFBQUFBQUFBQ0NBQUFBQUFBQUFBUUVBQUFJQUFBQUFBQUFBQUFBQUFBQUFBSUFDQUFBQUFBQWdBQUFBQUFCQUFBQUFBSUFBQ0FnQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQkFBQUFnQUFBUUFBQUFBQUFBQUFnQUFBQUFBQUFBQ2dBQUFBQUFBQWdBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYxNTQsImV4cCI6MTc4MjQ2Njk1NH0.X-vnA-S8SqI_xYwtj4SCr5Wc-vpdCk6hOZqUwwOKqxQ)

对于紧凑的 dg，一旦 drop 一个 disk，那么其 partner disk 已经无法保证冗余度，可以选择：

- 对于没有数据的 disk，disk04 与 disk03 一起 drop，但 YFS 的用户无法直接感知磁盘之间的伙伴关系，只能由 YFS 自行 drop disk，实际 drop 的disk数量与用于期望  **有差异**  ！！；
- 或 disk04 降级服务，不保证冗余度。此时 YFS 分配 Ext 时，无法分配足够的副本。Oracle 不允许冗余度降级，会在 drop 前平衡现有数据到 DG 中其他磁盘。因此这种方法不推荐。


#   [9. 功能总结【评估及优先级排序】](#9-功能总结评估及优先级排序)  

1. 调整 pst 的 ext 分配策略，随机化，均衡各 FG 读负载。
1. 解决客户端和服务端并发问题，之前由于客户端异常退出时会出现锁残留，造成 YFS 服务卡死，后面按文件做数据迁移时，客户端与服务端存在并发。
1. 支持文件权限，至少支持只读、读写模式，用于支持按文件数据迁移。
1. 支持 disk to disk 数据迁移，实现 alter diskgroup replace 指令。相比将数据再平衡到 FG 其他所有磁盘更简单，也无需考虑二次故障问题。
1. 实现 rebalancing，实现 FG 内数据平衡，并取消各 FG disk 数量必须一致的约束（否则无法drop disk）。
1. 支持 drop disk 和 add disk 时执行 rebalancing。
1. 实现同步和异步 rebalancing。


#   [读写权限控制的方法](#读写权限控制的方法)  

YFS 跟踪所有文件的打开模式，这种方式的好吃是避免 IO 中密集的检查文件权限，仅在打开文件时检查权限即可，与 VFS 实现类似。

唯一的问题是如果 DB 是长时间打开文件，那么会造成 filectrl 的权限无法变更，影响数据迁移或 rebalancing，有可能需要对 DB 操作文件的方式做一些调整。

![](https://pingcode.yasdb.com/atlas/files/public/6739da558970c2af4f5392c8/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFJQUNBQUFBQkFBQUFBQUFBQUFBQUNBQWdBQUFBQUFBQUFBQ0NBQUFBQUFBQUFBUUVBQUFJQUFBQUFBQUFBQUFBQUFBQUFBSUFDQUFBQUFBQWdBQUFBQUFCQUFBQUFBSUFBQ0FnQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQkFBQUFnQUFBUUFBQUFBQUFBQUFnQUFBQUFBQUFBQ2dBQUFBQUFBQWdBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYxNTQsImV4cCI6MTc4MjQ2Njk1NH0.X-vnA-S8SqI_xYwtj4SCr5Wc-vpdCk6hOZqUwwOKqxQ)

#   [参考文档](#参考文档)  

YFS 跟踪所有文件的打开模式，这种方式的好吃是避免 IO 中密集的检查文件权限，仅在打开文件时检查权限即可，与 VFS 实现类似。

![](https://pingcode.yasdb.com/atlas/files/public/6739da568970c2af4f5392c9/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFJQUNBQUFBQkFBQUFBQUFBQUFBQUNBQWdBQUFBQUFBQUFBQ0NBQUFBQUFBQUFBUUVBQUFJQUFBQUFBQUFBQUFBQUFBQUFBSUFDQUFBQUFBQWdBQUFBQUFCQUFBQUFBSUFBQ0FnQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQkFBQUFnQUFBUUFBQUFBQUFBQUFnQUFBQUFBQUFBQ2dBQUFBQUFBQWdBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYxNTQsImV4cCI6MTc4MjQ2Njk1NH0.X-vnA-S8SqI_xYwtj4SCr5Wc-vpdCk6hOZqUwwOKqxQ)

Rebalance 是按文件执行。

  [https://asmsupportguy.blogspot.com/2011/11/rebalancing-act.html](https://asmsupportguy.blogspot.com/2011/11/rebalancing-act.html)  

## Attachments:

[image2024-3-29_11-57-52.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc3NjNkZDAxZTE1NTEyMzViZWUzNDZmIiwicmVmX2lkIjoiNjc3NjNkZDAxZTE1NTEyMzViZWUzNDc5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU2MTUzLCJleHAiOjE3ODI1NDI1NTN9.2kBYM8kDH_rYMVO3J3Qu236bISoopO8HzilOm4BvWYY)

 (image/png)    


[image2024-4-7_16-56-6.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc3NjNkZDAxZTE1NTEyMzViZWUzNDcwIiwicmVmX2lkIjoiNjc3NjNkZDAxZTE1NTEyMzViZWUzNDc5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU2MTUzLCJleHAiOjE3ODI1NDI1NTN9.XZm3wQ1umefIu84TmKfuX-YGE2ZFKFgEjlGCwDcGpbA)

 (image/png)    


[download.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc3NjNkZDAxZTE1NTEyMzViZWUzNDcxIiwicmVmX2lkIjoiNjc3NjNkZDAxZTE1NTEyMzViZWUzNDc5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU2MTUzLCJleHAiOjE3ODI1NDI1NTN9.-Seai52Rx4CsaERWJyJ8YLH_VMrqh43H0ulnqflAJXw)

 (image/png)    


## Comments:

|  [](null)  ,有必要对文件增加权限控制，如基本的 rw 权限，目前看到的用处是，当对文件进行再平衡时文件可设置为只读模式，文件再平衡完毕后再设置为读写。,再平衡时可以逐个文件执行，文件的 IO 与再平衡总体上可以并发。,Posted by mayong at 三月 29, 2024 17:23|
|---|
|  [](null)  ,可以考虑先实现 power 关键字，兼容 oracle 用户习惯，真实功能可以晚点实现。,Posted by mayong at 三月 29, 2024 18:06|
|  [](null)  ,对现有功能的反思：最新的 ASM 要求 dg 内所有disk大小相同，那么实际上 YFS 除建 DG时之外，后续加盘实际上无需指定 size，因为磁盘 size 其实没有选择的余地。,Posted by mayong at 四月 01, 2024 09:20|
