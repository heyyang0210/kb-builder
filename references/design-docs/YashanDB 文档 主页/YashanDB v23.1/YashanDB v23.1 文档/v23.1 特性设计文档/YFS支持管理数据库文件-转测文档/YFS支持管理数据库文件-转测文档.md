Created by 马勇, last modified by  高风朴 on 六月 09, 2023

## 1. Overview（概述）

本文档 DB 指 Yasdb，YFS 指 Yasfs。

YFS 是 Yasdb 新增的存储模式，使 IO 过程绕过系统缓冲，直写磁盘块设备，达到接近操作裸设备的性能指标。

![](https://pingcode.yasdb.com/atlas/files/public/67396af4a1ad9a3311dc7ea1/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTAzNTUsImV4cCI6MTc4MjMwMTE1NX0.7Hb3_3wtgiBKq2eJ2-qSTWN24XQ920wQ3qNGruAJTRQ)

DB 集群模式下，所有数据直接通过 SCSI 协议保存在共享磁阵上。YFS 是 DB 管理共享磁阵的组件，实现类似一般文件系统的文件、目录创建、删除等管理操作，协调 Yasdb 多节点时操作共享磁阵。

## 2. Features（功能特性）

## 2.1 创建目录

在安装 DB 阶段，通过 yfscmd 创建所需的目录结构。目前 YFS 已经支持一个默认 Diskgroup：DG_0，无需重复创建。

## 2.2 创建文件

DB 通过 Device 层与 YFS 通信，建库、建表、建表空间等操作都会触发 YFS 创建文件的操作。

## 2.3 扩展文件

向表插入数据，当满足表空间扩展条件时，DB 通过 Device 层调用 YFS 扩展文件。

## 2.4 删除文件

删除表空间时，会触发删除文件操作。

## 3. Interfaces（接口）

## 3.1 建库

目前 DB 集群允许 3 种方式建库

可以通过以下 2 种精简指令建库：

```
create cluster database testdb instances 1;

```

注意 instance 后参数应当与 DB 实例数量相同。

```
create cluster database testdb instance();

```

或者通过完整建库语句：

```
create cluster database testdb
instance ( 
logfile(
'+DG_0/redo01' size 512M BLOCKSIZE 512, 
'+DG_0/redo02' size 512M BLOCKSIZE 512, 
'+DG_0/redo03' size 512M BLOCKSIZE 512
) 
UNDO TABLESPACE DATAFILE '+DG_0/undo00' size 512M autoextend on next 256M maxsize 64G 
)
SWAP TABLESPACE TEMPFILE '+DG_0/swap' size 512M autoextend on next 256M maxsize 64G 
DEFAULT TABLESPACE DATAFILE '+DG_0/users' size 512M autoextend on next 256M 
SYSTEM TABLESPACE DATAFILE '+DG_0/system' size 512M autoextend on next 32M maxsize 64G  
SYSAUX TABLESPACE DATAFILE '+DG_0/sysaux' size 512M autoextend on next 32M maxsize 64G 
TEMPORARY  TABLESPACE TEMPFILE '+DG_0/temp' size 512M autoextend on next 32M maxsize 64G;

```

注意     `+DG_0`     不能修改，目前仅支持 DG_0 一个 diskgroup，其他文件名、属性可以修改。

  


## 3.2 表空间

```
create tablespace yfs_spc_1 datafile '+DG_0/test_1.space' size 32M autoextend on next 4M maxsize 100M;

```

注意这里文件必须在 +DG_0/ 下。

  


## 3.3 读写

常规 DB 操作即可。

## 3.4 删除

通过 drop table space 实现。

## 4. Limitations（功能限制）

|限制|说明|
|---|---|
|单节点部署|集群版DB部署 1 个节点，暂未支持多节点模式|
|暂不考虑频繁删除的场景|磁盘空间延迟回收，大量删除的场景可能出现无法创建新文件、扩展文件|
|DB 运行中，不能通过 yfscmd 修改、删除数据文件|IO 并发由 DB 保证，yfscmd 可能损坏 DB 文件|
|数据文件名不能超过 31|建库、建表时需充分考虑数据文件命名后的长度|
|启停时可手工清理共享内存|DB、YFS 进程被杀死时无法优雅回收内存|
|仅支持 1 个 DB 实例|默认 data 目录为 DG_0，目前不考虑多实例 DB|
|不支持归档|  
|
|不支持双写|  
|


## 5. Detail Design（详细设计）

## 6. Testcases（用例）

DB 的基本建库、建表、增删改查。

尽可能扩大 DB 文件的大小，并执行在所有文件范围内覆盖 DB 读写操作。

DB 高并发场景下正常工作。

## 7. Workload（工作量）

## 8. TODO（遗留问题）

  


  


## Attachments: