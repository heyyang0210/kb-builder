Created by 郭藏龙, last modified on 四月 23, 2023

##   [一、概述](#一概述)  

diskgroup是YFS的逻辑存储结构，主要的作用对底层存储进行抽象，并对外提供文件系统的操作能力，与DB的tablespace概念类似。diskgroup可以对存储进行差异化管理，并提供故障隔离的能力。

diskgroup内部通过disk提供数据存储和访问能力，disk通常是一个LUN，不需要关注底层具体的存储。同一个diskgroup包含一个或多个disk，disk之间可以提供striping能力，并且可以通过增加或者删除disk来扩容和缩容。diskgroup内部通过failure group提供冗余能力，可以同时包含多个failure group。

diskgroup之间是互相独立的，不同的diskgroup可以指定不同的规格，例如redundancy level、failure group、AU size等。创建YFS对象时，需要指diskgroup。

diskgroup内部支持划分多个failure group，每个failure group包含若干可能会同时故障的disk。

![](https://conf.yasdb.com/download/attachments/107391618/image2023-4-21_11-57-45.png?version=1&modificationDate=1682049465932&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBSUFDQUFBQUFBQUFBQUFBUUFBQUFBQUFnQUFBQUFCQUFBQUNBQUFBQUFBQUFRQUFBQUFBQ0FBQUFBQUFBQ0FBQUNBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTAyNDAsImV4cCI6MTc4MjMwMTA0MH0.pzRYv5sYy2kYb25qcCzw5bFqj_aR6pDx2cd8XqPVndI)

##   [二、详细设计](#二详细设计)  

###   [2.1 failure group](#21-failure-group)  

####   [2.1.1 failure group概念](#211-failure-group概念)  

failure group是YFS高可用的核心概念，配合 “多副本” 特性共同实现数据冗余(包括元数据以及文件数据)。

每个failure group可以包含多个disk，这些disk有可能同时故障，例如以下场景：

1. 同一磁阵的 LUN；
1. 同一机柜的磁盘；
1. 同一电源供电的多个存储单元；
1. 同一机房的多个存储单元。


failure group之前不会同时故障(或者故障概率极低)，这样就可以保证数据冗余的有效性。

![](https://pingcode.yasdb.com/atlas/files/public/67396af28970c2af4f520019/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBSUFDQUFBQUFBQUFBQUFBUUFBQUFBQUFnQUFBQUFCQUFBQUNBQUFBQUFBQUFRQUFBQUFBQ0FBQUFBQUFBQ0FBQUNBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTAyNDAsImV4cCI6MTc4MjMwMTA0MH0.pzRYv5sYy2kYb25qcCzw5bFqj_aR6pDx2cd8XqPVndI)

####   [2.1.2 多副本](#212-多副本)  

在创建diskgroup时，可以通过redundancy level来指定副本数量和failure group的数量。

为了保证相同数据的不同副本分布在不同的failure group(两个副本在同一个failure group没有意义)，failure group必须大于等于副本数量。

如图是一个包含 3 故障组的的磁盘组，各故障组的磁盘之间组成 “伙伴关系”：当一个磁盘写入一个数据副本时，其他副本数据分别写入其伙伴磁盘中。

当向 disk0 写入一个绿色 extent data，那么它的另一个副本将被写入 disk0 的伙伴磁盘之一：disk2、disk4，图中绿色 data' 被写入 disk2。

当向 disk3 写入一个红色 extent data，它的另一个副本将被写入 disk3 的伙伴磁盘之一： disk1、disk5，图中红色 data' 被写入 disk5

![](https://conf.yasdb.com/download/attachments/107391618/image2023-4-21_14-8-4.png?version=1&modificationDate=1682057284404&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBSUFDQUFBQUFBQUFBQUFBUUFBQUFBQUFnQUFBQUFCQUFBQUNBQUFBQUFBQUFRQUFBQUFBQ0FBQUFBQUFBQ0FBQUNBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTAyNDAsImV4cCI6MTc4MjMwMTA0MH0.pzRYv5sYy2kYb25qcCzw5bFqj_aR6pDx2cd8XqPVndI)

每个磁盘中的 Partnership 记录了自己的伙伴磁盘，当向某个磁盘写入数据时，通过当前磁盘的伙伴关系，就可以立刻找到其他伙伴磁盘，且这些磁盘都不在同一故障组。

![](https://conf.yasdb.com/download/attachments/107391618/image2023-4-21_10-35-29.png?version=1&modificationDate=1682044529323&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBSUFDQUFBQUFBQUFBQUFBUUFBQUFBQUFnQUFBQUFCQUFBQUNBQUFBQUFBQUFRQUFBQUFBQ0FBQUFBQUFBQ0FBQUNBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTAyNDAsImV4cCI6MTc4MjMwMTA0MH0.pzRYv5sYy2kYb25qcCzw5bFqj_aR6pDx2cd8XqPVndI)

###   [2.2 disk管理](#22-disk管理)  

####   [2.2.1 disk元数据](#221-disk元数据)  

所有磁盘自治管理自身的所有状态，主要包含：

- 磁盘状态、所属故障组、磁盘组信息；
- 空闲空间及 AU 或 extent 管理；
- 与其他故障组磁盘的伙伴关系。


YFS 在 YCR 中也持久化了磁盘组、故障组、磁盘之间的组织关系。

####   [2.2.2 disk空间管理](#222-disk空间管理)  

disk通过bitmap管理空闲空间

#####   [bitmap的创建](#bitmap的创建)  

disk head(常驻内存)上记录了bitmap的元数据，例如起始的offset、大小、free count、free begin等信息。

#####   [bitmap的搜索](#bitmap的搜索)  

disk head(常驻内存)上记录了bitmap的元数据，例如起始的offset、大小、free count、free begin等信息。

bitmap位置在disk head之后，大小为disk size / AU size / 8。

#####   [bitmap的释放](#bitmap的释放)  

根据extent的AUID clean bitmap

###   [2.3 file空间管理](#23-file空间管理)  

一个fileCtrl占用一个block（4k）大小，存储的信息包括文件的属性信息（id，大小，space等）和FAT信息。FAT按照extent存储（0~19999 记录的AUID代表一个AUID， 20000~39999 记录的AUID代表4个连续的AUID，大于等于40000， 则记录的AUID代表连续的16个AUID），0~59号FAT记录直接AUID，60~359记录间接AUID。 间接AUID内按照4k大小划分为一个block，参考友商，一个block最多可以存储480个extentid。按照这样存储，计算文件最大size。FAT记录的extent个数为：60+(360-60)*(8M/4k)  *480=294912060个extent。按照extent的记录规则计算实际AUID个数为   20000+20000*  4+(294912060-40000)  *16=4718052960个AUID。一个AU8M。4718052960*  8M=37P，目前实际用不了那么大，但我们保留一部分能力，为后续版本演进预留空间（友商AUsize1M时，文件最大16T。友商实际能力做了保留）

![](https://conf.yasdb.com/download/attachments/107391618/image2023-4-21_10-56-31.png?version=1&modificationDate=1682045791720&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBSUFDQUFBQUFBQUFBQUFBUUFBQUFBQUFnQUFBQUFCQUFBQUNBQUFBQUFBQUFRQUFBQUFBQ0FBQUFBQUFBQ0FBQUNBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTAyNDAsImV4cCI6MTc4MjMwMTA0MH0.pzRYv5sYy2kYb25qcCzw5bFqj_aR6pDx2cd8XqPVndI)

###   [2.4 基于虚拟文件的元数据管理](#24-基于虚拟文件的元数据管理)  

####   [2.4.1 自解释的文件系统](#241-自解释的文件系统)  

![](https://conf.yasdb.com/download/attachments/107391618/image2023-4-21_11-40-55.png?version=1&modificationDate=1682048455157&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBSUFDQUFBQUFBQUFBQUFBUUFBQUFBQUFnQUFBQUFCQUFBQUNBQUFBQUFBQUFRQUFBQUFBQ0FBQUFBQUFBQ0FBQUNBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTAyNDAsImV4cCI6MTc4MjMwMTA0MH0.pzRYv5sYy2kYb25qcCzw5bFqj_aR6pDx2cd8XqPVndI)

我们需要在磁盘头记录第一个文件的第1个block位置（block从0开始）然后找到这个AU的位置。其第一个block内存放的即filenumber=1的fileCtrl。该AU内共存放2048个Block。全部是文件1的第一个extent包含的内容，文件1的FAT[0]指向的就是这个AUID. 共有2047个文件，全部预留为元数据文件。从第2048个文件开始，为用户创建的文件。用户创建的文件参考file空间管理

###   [2.5 元数据快速恢复区](#25-元数据快速恢复区)  

Failure Group 已经可以为所有数据（无论元数据、用户数据）提供充足的冗余，我们也可以额外提供一套元数据恢复机制作为补充，比如在 Faliure Group 没有冗余时支持元数据高可用。

虚拟元数据文件中的元数据快速恢复文件（Metadata Fast Recovery File）是一个有大小上限的文件，其中仅保存元数据的变更历史，循环写入。

  


![](https://pingcode.yasdb.com/atlas/files/public/67396af28970c2af4f52001a/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBSUFDQUFBQUFBQUFBQUFBUUFBQUFBQUFnQUFBQUFCQUFBQUNBQUFBQUFBQUFRQUFBQUFBQ0FBQUFBQUFBQ0FBQUNBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTAyNDAsImV4cCI6MTc4MjMwMTA0MH0.pzRYv5sYy2kYb25qcCzw5bFqj_aR6pDx2cd8XqPVndI)

当某个元数据出错，除了尝试从其他 Failure Group 的 Partner Disk 恢复外，也可以尝试从快速恢复文件中查找最近一次有效数据。由于 YFS 元数据变更频率较低，有可能找到最后一次写入的数据。

###   [2.6 AUID](#26-auid)  

AU id 安排与规格之间的关系（AU size 按 8M 计）：

- 22 bits Unit ID：单个磁盘最大支持 2^22 * 8MB = 32TB；
- 14 bits Disk ID：单个 Disk Group 最多支持 16384 个磁盘；


![](https://pingcode.yasdb.com/atlas/files/public/67396af2a1ad9a3311dc7e95/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBSUFDQUFBQUFBQUFBQUFBUUFBQUFBQUFnQUFBQUFCQUFBQUNBQUFBQUFBQUFRQUFBQUFBQ0FBQUFBQUFBQ0FBQUNBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTAyNDAsImV4cCI6MTc4MjMwMTA0MH0.pzRYv5sYy2kYb25qcCzw5bFqj_aR6pDx2cd8XqPVndI)

###   [2.7 共享内存管理](#27-共享内存管理)  

##   [三、QA](#三qa)  

#####   [1. 是否支持配置AU大小？](#1-是否支持配置au大小)  

可以支持，对机制无影响

#####   [2. File级别的空闲空间管理单位是AU还是extent？](#2-file级别的空闲空间管理单位是au还是extent)  

- 变长extent，提升空间分配效率、减少空间浪费
- 避免元数据频繁变更
- 对机制冲击不大


YFS以extent为单位管理文件级别的空闲空间

#####   [3. DG内部是否支持strip？](#3-dg内部是否支持strip)  

- 磁盘负载均衡
- 减少IO竞争，降低IO延迟


#####   [4. diskgroup内部元数据是采用硬编码存储，还是采用虚拟文件存储？](#4-diskgroup内部元数据是采用硬编码存储还是采用虚拟文件存储)  

- 虚拟文件：统一使用文件的冗余和扩展能力，但是对现有架构有冲击
- 硬编码：冗余机制、扩展能力要单独设计


#####   [5. YFS权限控制](#5-yfs权限控制)  

​	基于虚拟文件机制，创建访问控制文件

#####   [6. voting disk和voting file的可靠性](#6-voting-disk和voting-file的可靠性)  

​    quorum failure group

#####   [7. 全局disk group的元数据管理机制](#7-全局disk-group的元数据管理机制)  

- 全局的disk group信息持久化到YCR disk，启动时通过YCR disk加载
- disk也要存储自身的group信息，用于YCR损坏之后的重建


##   [四、方案对比](#四方案对比)  

|  
|现有方案|优化方案|
|---|---|---|
|diskgroup空闲空间管理|将所有disk的free AU通过map list的方式保存在root ctrl，申请AU的时候优先从free list上申请。,优点：实现简单，申请效率高,缺点：,1. 动态增加和删除disk处理麻烦
1. 不支持变长extent
1. 频繁申请和释放之后，free list上AU会离散化严重，影响后续的IO性能
|每个disk本地通过bitmap管理free AU,优点：,1. 支持变长
1. 频繁申请和释放不会导致IO离散化
1. disk变更处理简单
1. diskgroup和disk在AU管理上解耦
,缺点：,1. 空间开销比free list大：1个AU的bitmap可以管理512T的空间，开销可控
1. 申请效率较list管理稍差：需要搜索bitmap，但是可以做优化，影响不大
|
|diskgroup内元数据管理|通过硬编码的方式，例如固定redo AU, root AU, map AU的位置,优点：已经实现,缺点：,1. 扩展性差：每种类型的AU大小需要预留好，如果支持动态扩展的话需要设计新的机制
1. 冗余机制：元数据需要设计新的容易机制
1. 演进性差：如果后面需要支撑新的特性，元数据很难扩展，例如权限管理
,  
| 元数据通过虚拟文件来管理, 优点：元数据的扩展、冗余都可以复用文件的能力, 缺点：对现有代码冲击比较大|


##   [五、工作量评估](#五工作量评估)  

YFS的目标是6/30之前交付以下SR：

1. 支持多disk group：    [https://jira.yasdb.com/browse/YDBRD-13446](https://jira.yasdb.com/browse/YDBRD-13446)  
1. 支持管理裸设备(包括map扩展、free AU管理优化):     [https://jira.yasdb.com/browse/YDBRD-13443](https://jira.yasdb.com/browse/YDBRD-13443)  
1. 元数据的冗余机制：    [https://jira.yasdb.com/browse/YDBRD-13443](https://jira.yasdb.com/browse/YDBRD-13443)  
1. 元数据CRC校验:     [https://jira.yasdb.com/browse/YDBRD-13444](https://jira.yasdb.com/browse/YDBRD-13444)  


这些需求都依赖于此次架构调整，而且调整之后方案都是比较明确的。整体工作量评估如下，共计20人/周

|关键任务|工作量(人/周)|
|---|---|
|failure group|4|
|disk空间管理|2|
|file空间管理|4|
|通过虚拟文件管理元数据|4|
|元数据快速恢复区|2|
|元数据CRC|2|


## Attachments:

[image2023-4-21_10-24-2.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZjA4OTcwYzJhZjRmNTIwMDA1IiwicmVmX2lkIjoiNjczOTZhZjA3MjgyMDZlZmI5MmVmZjg5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwMjQwLCJleHAiOjE3ODIzNzY2NDB9.3aouFjn4TyHIeV0_AunQfvlxgf85v_ImYPKjTllLANw)

 (image/png)    


[image2023-4-21_10-28-42.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZjA4OTcwYzJhZjRmNTIwMDA2IiwicmVmX2lkIjoiNjczOTZhZjA3MjgyMDZlZmI5MmVmZjg5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwMjQwLCJleHAiOjE3ODIzNzY2NDB9.73jPjOoC0YFlDY3XLxoERPGROVEZC-xfR2MWOVLwknk)

 (image/png)    


[image2023-4-21_10-35-29.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZjBhMWFkOWEzMzExZGM3ZTdmIiwicmVmX2lkIjoiNjczOTZhZjA3MjgyMDZlZmI5MmVmZjg5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwMjQwLCJleHAiOjE3ODIzNzY2NDB9.VXn_1m7ru3v7nGsDf8i5ooMHuuHnXW5FbnZUSQQMRcw)

 (image/png)    


[image2023-4-21_10-42-31.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZjA4OTcwYzJhZjRmNTIwMDA4IiwicmVmX2lkIjoiNjczOTZhZjA3MjgyMDZlZmI5MmVmZjg5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwMjQwLCJleHAiOjE3ODIzNzY2NDB9.kiIyShAp5ngxKHgJHnm_o9r7zgqKzIILIJlLl82a9mg)

 (image/png)    


[image2023-4-21_10-49-52.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZjA4OTcwYzJhZjRmNTIwMDA5IiwicmVmX2lkIjoiNjczOTZhZjA3MjgyMDZlZmI5MmVmZjg5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwMjQwLCJleHAiOjE3ODIzNzY2NDB9.2YFjJsdLaP0z8sH9rg1IrGUyUypzCP0NYYS-mP3nvLk)

 (image/png)    


[image2023-4-21_10-50-27.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZjFhMWFkOWEzMzExZGM3ZTgwIiwicmVmX2lkIjoiNjczOTZhZjA3MjgyMDZlZmI5MmVmZjg5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwMjQwLCJleHAiOjE3ODIzNzY2NDB9.N8rGlWvJm-15xBm69JpGIJVCQAh__iMHa70W-K371tw)

 (image/png)    


[image2023-4-21_10-51-15.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZjFhMWFkOWEzMzExZGM3ZTgxIiwicmVmX2lkIjoiNjczOTZhZjA3MjgyMDZlZmI5MmVmZjg5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwMjQwLCJleHAiOjE3ODIzNzY2NDB9.c1c5QbFcw4lC5LaTtotUjgWxvSZmCaFlmcSbooPDFK8)

 (image/png)    


[WXWorkLocal_16820455745538.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZjE4OTcwYzJhZjRmNTIwMDBhIiwicmVmX2lkIjoiNjczOTZhZjA3MjgyMDZlZmI5MmVmZjg5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwMjQwLCJleHAiOjE3ODIzNzY2NDB9.W6IgADptvG-kWHtdE9Hl0Nld_-rO8gXrqlll8TFxEt8)

 (image/png)    


[image2023-4-21_10-56-31.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZjFhMWFkOWEzMzExZGM3ZTgyIiwicmVmX2lkIjoiNjczOTZhZjA3MjgyMDZlZmI5MmVmZjg5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwMjQwLCJleHAiOjE3ODIzNzY2NDB9.6wMiLBOgQxCr48Z8XBzL0pHvQ-e8_2VaPP4B7_0h5dE)

 (image/png)    


[image2023-4-21_11-40-55.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZjFhMWFkOWEzMzExZGM3ZTgzIiwicmVmX2lkIjoiNjczOTZhZjA3MjgyMDZlZmI5MmVmZjg5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwMjQwLCJleHAiOjE3ODIzNzY2NDB9.q3L3cNIRAO3IQ9DrETLtf_hK_ezUt0BY7V7tVTI576g)

 (image/png)    


[image2023-4-21_11-57-45.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZjE4OTcwYzJhZjRmNTIwMDBiIiwicmVmX2lkIjoiNjczOTZhZjA3MjgyMDZlZmI5MmVmZjg5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwMjQwLCJleHAiOjE3ODIzNzY2NDB9.srViMd8CS-GoyXxAMsvRvUceiRNg4kIVMGW-_Xv6GlI)

 (image/png)    


[image2023-4-21_14-8-4.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZjE4OTcwYzJhZjRmNTIwMDBjIiwicmVmX2lkIjoiNjczOTZhZjA3MjgyMDZlZmI5MmVmZjg5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwMjQwLCJleHAiOjE3ODIzNzY2NDB9.bRENdm1mIChFakJjiA0I_913YJojgS4ChONFFdFLIqI)

 (image/png)    


[image2023-4-21_14-53-54.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZjFhMWFkOWEzMzExZGM3ZTg2IiwicmVmX2lkIjoiNjczOTZhZjA3MjgyMDZlZmI5MmVmZjg5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwMjQwLCJleHAiOjE3ODIzNzY2NDB9.ZeVZt0mV3RDZ5z-Hi3ljT3XsPbc2Ap5v8u7P4kufoPI)

 (image/png)    


[image2023-4-21_15-0-16.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZjE4OTcwYzJhZjRmNTIwMDBmIiwicmVmX2lkIjoiNjczOTZhZjA3MjgyMDZlZmI5MmVmZjg5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwMjQwLCJleHAiOjE3ODIzNzY2NDB9.InqWAhNYq_wavJJmdS5-EzDpRDawVJHEkmQoc4wL0ck)

 (image/png)    


[image2023-4-21_15-12-13.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZjE4OTcwYzJhZjRmNTIwMDExIiwicmVmX2lkIjoiNjczOTZhZjA3MjgyMDZlZmI5MmVmZjg5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwMjQwLCJleHAiOjE3ODIzNzY2NDB9.STnSALUFd385aLcwc3cRdG9YIlUYaOjqYUPigq53bI8)

 (image/png)    


[image2023-4-21_17-35-24.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZjE4OTcwYzJhZjRmNTIwMDEyIiwicmVmX2lkIjoiNjczOTZhZjA3MjgyMDZlZmI5MmVmZjg5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwMjQwLCJleHAiOjE3ODIzNzY2NDB9.yxHKDGnQjUM5beDkHCnWiP2a4ZC7mXBH2t5eWaG8qsw)

 (image/png)    


[image2023-4-21_17-44-11.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZjE4OTcwYzJhZjRmNTIwMDE0IiwicmVmX2lkIjoiNjczOTZhZjA3MjgyMDZlZmI5MmVmZjg5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwMjQwLCJleHAiOjE3ODIzNzY2NDB9.SbAsPpFTsZQDxvkjsitJ5H72yAmt2e76TaNdBr7mUjQ)

 (image/png)    


[image2023-4-21_17-59-10.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZjFhMWFkOWEzMzExZGM3ZTg4IiwicmVmX2lkIjoiNjczOTZhZjA3MjgyMDZlZmI5MmVmZjg5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwMjQwLCJleHAiOjE3ODIzNzY2NDB9.SD3p1rg0WXY-sCjoTfJkbxt9f2ni2GLrre6sdT1kN7Y)

 (image/png)    


[image2023-4-21_18-39-25.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZjE4OTcwYzJhZjRmNTIwMDE1IiwicmVmX2lkIjoiNjczOTZhZjA3MjgyMDZlZmI5MmVmZjg5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwMjQwLCJleHAiOjE3ODIzNzY2NDB9.bKDVjVenrW62AVfanCYuCnt44gdVEeQ2iYl17wP8seY)

 (image/png)    


[image2023-4-21_18-40-30.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZjI4OTcwYzJhZjRmNTIwMDE2IiwicmVmX2lkIjoiNjczOTZhZjA3MjgyMDZlZmI5MmVmZjg5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwMjQwLCJleHAiOjE3ODIzNzY2NDB9.zeMWb4J8CjOWKVfRBGB_4wBYASgVNczrYV73zFtQbzE)

 (image/png)    


[image2023-4-21_18-40-30.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZjJhMWFkOWEzMzExZGM3ZThlIiwicmVmX2lkIjoiNjczOTZhZjA3MjgyMDZlZmI5MmVmZjg5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwMjQwLCJleHAiOjE3ODIzNzY2NDB9.IK5DdmNKadzkVSbEdc930M9BD63ZLZThbS8nTK4H6n8)

 (image/png)    


## Comments:

|  [](null)  ,4/19 讨论结果：,1.基于diskgroup进行磁盘管理，并且可以配置au size，redundancy level,2.diskgroup的空闲au由disk本地管理,3.file的空闲空间管理以extent为单位,4.stripe能力要预留，当前版本可以不支持,5.全局的disk group信息持久化到YCR disk，启动时通过YCR disk加载；disk也要存储自身的group信息，用于YCR损坏之后的重建,6.diskgroup内部元数据存储方式是采用硬编码还是虚拟文件，细化方案，周五进行讨论,Posted by guocanglong at 四月 19, 2023 18:27|
|---|
