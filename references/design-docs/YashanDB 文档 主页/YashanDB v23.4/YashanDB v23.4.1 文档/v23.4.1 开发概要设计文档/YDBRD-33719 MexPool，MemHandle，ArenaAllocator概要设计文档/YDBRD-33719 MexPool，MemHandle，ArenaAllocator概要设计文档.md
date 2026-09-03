Created by 唐嘉欣, last modified on 十月 25, 2024

*概要设计-YDBRD-33719 : 内存池统一 *    [https://pingcode.yasdb.com/pjm/items/6707338de489dd0868f344d4](https://pingcode.yasdb.com/pjm/items/6707338de489dd0868f344d4)  

*IR链接：*    [https://pingcode.yasdb.com/ship/ideas/66d01d1a89f961f330102df4](https://pingcode.yasdb.com/ship/ideas/66d01d1a89f961f330102df4)  

##   [1. 总述](#1-总述)  

本需求属于内部需求，实现新的MexPool，MemHandle，ArenaAllocator，以满足后续的需求对于不同长度连续内存的需要。

###   [1.1 需求来源](#11-需求来源)  

内部需求，支持单机，分布式，集群

###   [1.2 调研文档](#12-调研文档)  

MemoryPool概要设计文档：    [https://conf.yasdb.com/pages/viewpage.action?pageId=144131531](https://conf.yasdb.com/pages/viewpage.action?pageId=144131531)  

旧MexPool概要设计文档：    [https://conf.yasdb.com/pages/viewpage.action?pageId=144130421](https://conf.yasdb.com/pages/viewpage.action?pageId=144130421)  

###   [1.3 需求分析](#13-需求分析)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|SR|
|---|---|---|---|---|---|
|功能|MemoryPool|见后文|是|是|----|
||MemHandle|见后文|是|是|----|
||ArenaAllocator|见后文|是|是|----|
|性能|并发性能|见后文|是|是|----|
||单线程性能|见后文|是|是|----|
|可用性|恢复场景|----|否|否|----|
|可靠性|故障场景|----|否|否|----|
|可维可测|----|----|否|否|----|
|安全|安全场景1|----|否|否|----|
|易用性|----|----|否|否|----|
|可修改性|----|----|否|否|----|
|兼容性|----|----|否|否|----|
|周边配合|权限|----|----|否|----|
|周边配合|审计|----|----|否|----|
|周边配合|导入导出工具|----|----|否|----|


###   [1.4 数据字典](#14-数据字典)  

**描述本篇文档中特性的术语集**

|术语|描述|借鉴业界|参考|
|---|---|---|---|
|MexPool|内存分配器，管理一大段连续内存，并提供任意长度连续内存的分配功能|----|----|
|MemHandle|线程内部内存分配器，从MexPool先缓存部分内存，并在线程内部管理缓存内存的分配和释放|----|----|
|ArenaAllocator|arena内存分配器，从MexPool或者MemHandle中申请内存页，并进行管理，arena分配器可支持任意长度连续内存的分配，并提供最后统一释放的功能|----|----|


###   [1.5 开源依赖](#15-开源依赖)  

无

##   [2. 接口](#2-接口)  

|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|SQL语法|语法分支1描述|----|否|
|SQL语法|语法分支2描述|----|否|
|函数|参数/返回值描述|----|否|
|高级包|高级包子对象描述|----|否|
|系统视图|视图域段描述|----|否|
|动态视图|视图域段描述|----|否|


```
/* 代码接口 */
/* MemHandle init 此处采用懒加载，在alloc时才会真正bind负载最轻的area */
void mHandleInit(MemHandle* handle, MemBase* base);

/* MemHandle alloc */
static COD_INLINE CodChar* mHandleAlloc(MemHandle* handle, CodUint64 size);

/* MemHandle free */
static COD_INLINE void mHandleFree(MemHandle* handle, CodChar* addr);

/* MemHandle destroy */
void mHandleDestroy(MemHandle* handle);

/* arena init 可能会更改，不再使用area，改为使用MemHandle */
static COD_INLINE void arenaInit(ArenaAllocator* arena, CodUint32 pageSize, CodUint32 maxPageSize, MemArea* area);

/* arena alloc */
static COD_INLINE CodResult arenaAlloc(ArenaAllocator* arena, CodUint32 size, CodChar** buf);

/* arena release */
void arenaReuse(ArenaAllocator* arena);
void arenaFastReuse(ArenaAllocator* arena);

```

##   [3. 规格与约束](#3-规格与约束)  

**说明从IR层级对外的功能规格或约束。结合《特性调研文档》，给出我们与竞品的差异点、优缺点描述。**  规格要参考商业数据库，由SE给出，由产品评审。约束需要SE/MDE确定方案给出。

##   [4. 特性](#4-特性)  

###   [4.1 MexPool](#41-mexpool)  

MexPool本质上是先从系统分配一块超大的连续内存α（后文中的指代），然后再内部管理这一大块内存的分配和使用。MexPool的内存分配算法类似与Linux的伙伴分配器，能够有效消除内存块之间的碎片化问题。

- **MemEden：伊甸园，用于描述原始的一大块连续内存α的布局**


老版本：

![](https://pingcode.yasdb.com/atlas/files/public/6739a37ca1ad9a3311dd58ba/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQkFFQUFEQUFBQUFBQUFBQUFBQUlBQWdBQ0FBQUFDQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUlnQUFBQUFBQWdBQUFvQUFBQUFBQ0JBR0FJQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFnQUFBQUFrQUFBQUFBQUFBQUFBQUFRQUFBSUFBQUFRQUFBQUFBUUFBQUFBQUNBUUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY2NzIsImV4cCI6MTc4MjQ2NzQ3Mn0.qzOOhs1kGpz5AWuMDv54O8LHOAdn4wYdcowd6fJT4e8)

新版本：

![image.png](https://pingcode.yasdb.com/atlas/files/public/67fcedf6f759dc060e663cf0/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQkFFQUFEQUFBQUFBQUFBQUFBQUlBQWdBQ0FBQUFDQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUlnQUFBQUFBQWdBQUFvQUFBQUFBQ0JBR0FJQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFnQUFBQUFrQUFBQUFBQUFBQUFBQUFRQUFBSUFBQUFRQUFBQUFBUUFBQUFBQUNBUUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY2NzIsImV4cCI6MTc4MjQ2NzQ3Mn0.qzOOhs1kGpz5AWuMDv54O8LHOAdn4wYdcowd6fJT4e8)

- **MemBase，MemArea，MemBin的结构**


MemBase是MexPool中全局唯一的，访问base的锁冲突最激烈，适用范围：sizeId > 63，即size > 2MB

MemArea将base划分成多个区域，主要目的是降低锁冲突，一个area可以被多个线程使用，因此仍旧需要加锁，适用范围：35 <= sizeId <= 63，即16KB <= size <= 2MB

MemBin主要用于处理小内存的分配场景，适用范围：0 <= sizeId <= 34，即16B <= size <= 14KB

内存池将不同大小的size使用sizeId，pageSizeId来分类，可参考下表：

|baseLg/deltaLg|stride|size||||||||
|---|---|---|---|---|---|---|---|---|---|
|||sizeId/pageSizeId|deltaId=1|sizeId/pageSizeId|deltaId=2|sizeId/pageSizeId|deltaId=3|sizeId/pageSizeId|deltaId=4|
|pseudo|16B|0|16B|1|32B|2|48B|3|64B|
|6/4|16B|4|80B|5|96B|6|112B|7|128B|
|7/5|32B|8|160B|9|192B|10|224B|11|256B|
|8/6|64B|12|320B|13|384B|14|448B|15|512B|
|9/7|128B|16|640B|17|768B|18|896B|19|1KB|
|10/8|256B|20|1280B|21|1536B|22|1792B|23|2KB|
|11/9|512B|24|2560B|25|3072B|26|3584B|27/0|4KB|
|12/10|1KB|28|5KB|29|6KB|30|7KB|31/1|8KB|
|13/11|2KB|32|10KB|33/2|12KB|34|14KB|35/3|16KB|
|14/12|4KB|36/4|20KB|37/5|24KB|38/6|28KB|39/7|32KB|
|15/13|8KB|40/8|40KB|41/9|48KB|42/10|56KB|43/11|64KB|
|16/14|16KB|44/12|80KB|45/13|96KB|46/14|112KB|47/15|128KB|
|17/15|32KB|48/16|160KB|49/17|192KB|50/18|224KB|51/19|256KB|
|18/16|64KB|52/20|320KB|53/21|384KB|54/22|448KB|55/23|512KB|
|19/17|128KB|56/24|640KB|57/25|768KB|58/26|896KB|59/27|1MB|
|20/18|256KB|60/28|1280KB|61/29|1536KB|62/30|1792KB|63/31|2MB|


其中，pageSizeId的0~3分别对应size为：4KB，8KB，12KB，16KB

![](https://pingcode.yasdb.com/atlas/files/public/6739a37c8970c2af4f52da62/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQkFFQUFEQUFBQUFBQUFBQUFBQUlBQWdBQ0FBQUFDQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUlnQUFBQUFBQWdBQUFvQUFBQUFBQ0JBR0FJQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFnQUFBQUFrQUFBQUFBQUFBQUFBQUFRQUFBSUFBQUFRQUFBQUFBUUFBQUFBQUNBUUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY2NzIsImV4cCI6MTc4MjQ2NzQ3Mn0.qzOOhs1kGpz5AWuMDv54O8LHOAdn4wYdcowd6fJT4e8)

- **MexPool不同大小内存的分配过程**


![](https://pingcode.yasdb.com/atlas/files/public/6739a37c8970c2af4f52da63/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQkFFQUFEQUFBQUFBQUFBQUFBQUlBQWdBQ0FBQUFDQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUlnQUFBQUFBQWdBQUFvQUFBQUFBQ0JBR0FJQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFnQUFBQUFrQUFBQUFBQUFBQUFBQUFRQUFBSUFBQUFRQUFBQUFBUUFBQUFBQUNBUUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY2NzIsImV4cCI6MTc4MjQ2NzQ3Mn0.qzOOhs1kGpz5AWuMDv54O8LHOAdn4wYdcowd6fJT4e8)

###   [4.2 MemHandle](#42-memhandle)  

MemHandle是线程内部使用的内存分配器，无锁设计，主要通过从area中一次分配一块内存作为缓存，并管理缓存的分配和释放，主要的数据结构是：MemThreadCache，MemCacheBin

- **MemThreadCache**


MemThreadCache成员变量作用：

>   cacheBins：每个sizeId一个MemCacheBin，只支持sizeId在[0, 39]时的缓存    fillDivLg：每次fill（从area/base填满cache的比例），一般是1，即50%    refilled：是否fill过    list：MemHandle bind area之后，会把list加入area的tCacheList链表中，unbind时，会把list从area的tCacheList链表中移除    allocMem：cacheBins中所有指针的内存都在这，这是一个指针数组  

MemThreadCache中有40个MemCacheBin，当sizeId在[0, 39]时，支持缓存，具体情况如下：

1. sizeId在[0, 34]时，每次从area中申请可填满一定比例的cacheBin（由fillDivLg指定，通常是一半）；
1. sizeId在[35, 39]时，每次从area中只能申请一块内存，不过该内存释放时，可以放入cacheBin中，以便后续的复用；
1. sizeId在[40, 63]时，每次从area中只能申请一块内存，该内存释放时，不能缓存，直接回到area中；
1. sizeId在[64, M_SC_CHUNK_LG)时，每次从base中只能申请一块内存，该内存释放时，不能缓存，直接回到base中；


另外，MemThreadCache还支持定时GC（垃圾清理）

- **MemCacheBin**


MemCacheBin成员变量作用：

>   stackHead：栈头，左边（低地址）是暂未填充的缓存空间，右边（高地址）是已经填充，可被alloc的缓存空间    lowWaterLowBits：水位线，左边是可以随意alloc的内存，右边是保留内存，只有在要求移动水位线的时候才能使用该内存    fullLowBits：栈满地址    emptyLowBits：栈空地址  

内存结构：

![](https://pingcode.yasdb.com/atlas/files/public/6739a37c8970c2af4f52da64/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQkFFQUFEQUFBQUFBQUFBQUFBQUlBQWdBQ0FBQUFDQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUlnQUFBQUFBQWdBQUFvQUFBQUFBQ0JBR0FJQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFnQUFBQUFrQUFBQUFBQUFBQUFBQUFRQUFBSUFBQUFRQUFBQUFBUUFBQUFBQUNBUUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY2NzIsImV4cCI6MTc4MjQ2NzQ3Mn0.qzOOhs1kGpz5AWuMDv54O8LHOAdn4wYdcowd6fJT4e8)

###   [4.3 ArenaAllocator](#43-arenaallocator)  

arena内存分配器主要提供了一把释放的功能，内存分配后，无需每次释放，只需要在最后一把释放即可

ArenaAllocator成员变量介绍：

>   head：list头，big page往head挂    tail：list尾，normal page往list挂    curr：只会指向当前使用中的normal page，若没有normal page，则curr为NULL    count：normal page和big page总共的页面数    pageSize：当前分配normal page时分配的pageSize，翻倍扩展，不包括page头    maxPageSize：最大支持的normal page大小，超过此大小则会被当作big page，不包括page头    holdBytes：当前持有的内存大小（alloc，free的时候都会更新）    usedBytes：使用过的内存大小（只有alloc的时候会更新）  

arena内存分配器主要包括两种分配模式：arenaAllocNormal，arenaAllocBig

- arenaAllocNormal


normal page往tail上挂，curr只会指向当前的normal page，如果没有normal page，即使有big page，curr仍旧为NULL

curr是正在使用的normal page，如果curr->next存在，则该page也是normal page，但未被使用，可以被复用，如果不能复用，则会释放该page，并重新申请合适大小的page

pageSize是curr page的size，不包括page head，如果pageSize不够大，会进行扩展（翻倍），只会扩展，不会回缩。pageSize的初始值就是arena的启动成本，批量执行设置为1KB

- arenaAllocBig


big的ArenaPage往head上挂

只有当申请的size大于maxPageSize时，才会用到big page

- arena页面链表的结构


![](https://pingcode.yasdb.com/atlas/files/public/6739a37ca1ad9a3311dd58bb/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQkFFQUFEQUFBQUFBQUFBQUFBQUlBQWdBQ0FBQUFDQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUlnQUFBQUFBQWdBQUFvQUFBQUFBQ0JBR0FJQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFnQUFBQUFrQUFBQUFBQUFBQUFBQUFRQUFBSUFBQUFRQUFBQUFBUUFBQUFBQUNBUUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY2NzIsImV4cCI6MTc4MjQ2NzQ3Mn0.qzOOhs1kGpz5AWuMDv54O8LHOAdn4wYdcowd6fJT4e8)

当申请新的normal page时，会尝试复用normal page 4，如果能复用，则curr指向normal page 4；如果不能复用则释放掉normal page 4，尝试复用normal page 5，如果能复用，则curr指向normal page 5；如果不能复用则释放掉normal page 5，从MemArea中重新申请内存

- arena释放


arena的释放方式有两种：arenaReuse，arenaFastReuse，这两种方式都会一把释放掉所有的arena页面

arenaReuse：此方法会将big page，normal page全部释放，并将内存页全部归还给arena使用的内存分配器

arenaFastReuse：此方法会将big page全部释放，并将big page内存归还给arena使用的内存分配器；但是对于normal page，只会逻辑上释放，curr指向第一个normal page，后续的normal page均可复用，最后再将holdBytes，usedBytes，offset之类的全部置0；  **此处有个问题，如果pageSize大于maxPageSize，那么判断是否为normal page将会失效，导致内存页全部释放，arenaFastReuse将会退化成arenaReuse**

##   [5.未来规划](#5未来规划)  

1. area的数量应该由cpu的个数决定，应该使用配置参数调整area的数量
1. arena分配器应该通过MemHandle来申请内存，而不是area


## Attachments:

[image2024-10-22_17-12-43.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOWEzN2JhMWFkOWEzMzExZGQ1OGI1IiwicmVmX2lkIjoiNjczOWEzN2I1OTNmOTljOWZmMjRiZDRhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU2NjcyLCJleHAiOjE3ODI1NDMwNzJ9.f1b9XxNJ30aPVv1ImfBlXfgcevn0fbt23zkyoe6kb74)

 (image/png)    


[image2024-10-24_11-19-48.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOWEzN2JhMWFkOWEzMzExZGQ1OGI4IiwicmVmX2lkIjoiNjczOWEzN2I1OTNmOTljOWZmMjRiZDRhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU2NjcyLCJleHAiOjE3ODI1NDMwNzJ9.2H81enOO8k8nMCHySkbo5CRudgf5CJjtmhNPkDxDGSM)

 (image/png)    


## Comments:

|  [](null)  ,会议纪要：,1. 高并发场景关注gc性能，有无性能波动
,Posted by tangjiaxin at 十月 29, 2024 16:01|
|---|
|  [](null)  ,**注意：**,MemHandle支持在handle1申请内存，在handle2释放内存，但是最好不要这样做，可能存在内存重复释放的风险,对于大于32KB的内存的释放，会直接进入area中，如果重复释放会在断言的地方core掉；但是对于小于等于32KB的小内存的释放，释放后会进入cacheBin的缓存中，此时如果重复释放，有可能会导致检查失效，从而造成内存踩踏,典型场景：,CodChar* smallBuf = mHandleAlloc(handle1, KB(1));,mHandleFree(handle2, smallBuf);,mHandleFree(handle1, smallBuf);,此时检测不到重复释放，不会core，handle1和handle2中均会缓存smallBuf内存块，从而造成内存踩踏,Posted by tangjiaxin at 十月 30, 2024 10:34|


