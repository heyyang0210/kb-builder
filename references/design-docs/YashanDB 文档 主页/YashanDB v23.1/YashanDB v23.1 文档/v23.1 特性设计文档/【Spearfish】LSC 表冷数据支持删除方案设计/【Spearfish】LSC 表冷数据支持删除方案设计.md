Created by 黄文早, last modified on 五月 23, 2023

#   [Lsc Static Data Support Deletion Design（lsc 表冷数据支持删除方案设计）](#lsc-static-data-support-deletion-designlsc-表冷数据支持删除方案设计)  

##   [1. Overview（概述）](#1-overview概述)  

​		更新/删除作为数据库的基础能力，lsc表的冷数据还不支持，导致一些场景下，例如插入了错误的数据，使得lsc表不可用，因此拓展lsc表能力，使其支持更新删除非常有必要。

​		本文档提供一种lsc冷数据 删除的方案：存储发生删除slice 的delete bitmap，通过delete bitmap 记录冷数据的删除信息。本文主要包括：1）delete bitmap 实现2）lsc 删除流程 	3）slice延迟删除机制

##   [2. Features（功能特性）](#2-features功能特性)  

​		lsc冷数据支持删除。

##   [3. Interfaces（接口）](#3-interfaces接口)  

```
CodResult coralDelete(AnkCursor* cursor);
CodResult coralLock(AnkCursor* cursor);

```

##   [4. Limitations（功能限制）](#4-limitations功能限制)  

```
   1、不支持多表update
   2、分布式暂不支持列存表update/delete带子查询，限制了本SR在分布式下的表现
   3、不支持指定slice删除
   4、行锁放大到 chunk 级别，锁冲突增大。
   5、select for update skip locked 语句发现锁冲突，不跳过整个slice，直接报错
   6、未打开row movement 发现delete冲突则跳过，打开row movement 发现delete冲突则语句重启，由于分布式当前不支持row movement ，发生delete 冲突，直接跳过

```

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 存储结构](#51-存储结构)  

![](https://pingcode.yasdb.com/atlas/files/public/67396afc8970c2af4f52006e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUNBQUFBQUFBQUFBQUFBQUNBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQVFBQUFBRUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA0OTgsImV4cCI6MTc4MjMwMTI5OH0.4GPW_V7d8IUkTGE4vbUtkKalM-m5Dr1kHy-R1O6-mlc)

###   [5.2 Delete Bitmap 实现](#52-delete-bitmap-实现)  

​		将slice 分为多个大小相等（每个slice的最后一个chunk除外）的chunk。每个chunk 在系统表中存储一条记录。扫描时，根据过滤后的结果在slice中的rowid去取对应chunk的delete bitmap。

​		为了减少空间损耗，chunk 写入时，如果chunk 大小未达到chunk 最大大小，尝试使用rle 编码，后续如果出现rle 编码长度大于等于编码bitmap 长度，之后的chunk 都不编码。

​		系统表定义如下：

```
CREATE TABLE SCOL_DELETE_BITMAP${
	SLICE_FILE_ID &nbsp;  BINARY_BIGINT &nbsp; NOT NULL, &nbsp;  
	CHUNK_ID &nbsp; &nbsp; &nbsp; &nbsp; BINARY_SMALLINT NOT NULL,
	BITMAP &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; CLOB &nbsp; &nbsp; &nbsp; &nbsp; &nbsp;  
}SYSTEM 162 ORGANIZATION HEAP;
CREATE INDEX I_DELETE_BITMAP_CHUNK ON SCOL_DELETE_BITMAP$(SLICE_FILE_ID, CHUNK_ID);

```

​		允许用户建表时自定义chunk 大小，定义后无法更改，默认粒度为32K，最大粒度为4G最小粒度为1 但是会超出btree 的最大限制。

​		假设一个 节点存在 128T  的数据，每个slice 2M 数据 平均长度为256 字节chunk为64K，则chunk数量为(128T/(2M*256)* ( 2M/64K) = 8M条记录，完全可以存在一个btree中。

​		为了减少访问系统表次数，需要在swd上增加一个flag，如果slice 发生过delete，无论这个delete 是否提交，都使用一个自治事务将swd中的flag记为true。扫描时，如果扫描到slice中的数据发生过删除，才去系统表中查找delete bitmap。

###   [5.3 Coral Scan](#53-coral-scan)  

​		扫描coral时，需要将coast 返回的数据与delete bitmap合并，得到最终结果。

####   [1. load meta and delete bitmap](#1-load-meta-and-delete-bitmap)  

​		当扫描一个新的slice chunk时，需要将其元数据和delete bitmap加载到内存中。

####   [2. scan with rowid](#2-scan-with-rowid)  

​		coral查询与正常查询一致，但是，由于条件下推后，coast返回的结果会经过压缩，导致在dataset中的偏移与delete bitmap中rowid 不一致，coast需要返回每一行在slice内的偏移，rowid 格式为slice id + offset。

####   [3. merge delete bitmap](#3-merge-delete-bitmap)  

​			coast 返回一个data set后，需要将delete bitmap和data set的 valid bitmap合并，生成新的valid bitmap。

###   [5.4 Delete 执行](#54-delete-执行)  

####   [5.3.1 prepare阶段](#531-prepare阶段)  

#####   [1. set scan filter](#1-set-scan-filter)  

​     	为了update/delete条件的快速过滤，需要将update/detete条件下推到存储。

​		因此，sql需要与列式查询执行一样，识别出：存储可以执行的条件和存储不能执行的条件。将存储可以执行的条件通过range set传给存储。对于不可下推的条件，存储在execute阶段使用回调进行过滤。存储提供接口ankSetColumnFilter 设置一列的range set条件。另外，vgd条件下推未实现，需要测试vgd的条件下推正确性。

####   [5.3.2 execute阶段](#532-execute阶段)  

#####   [1. lock slice](#1-lock-slice)  

​		冷数据更新时，rowid和数据将返回到执行层，如果此时发生slice合并导致slice被删除，根据rowid将无法找回原行。此时需要保证返回的rowid不会发生改变，可以在slice上加共享锁，合并slice时在slice上加独占锁。当前swd只有行锁，无法共享，需要为coral slice实现共享锁。

######   [锁实现](#锁实现)  

```
typedef struct StSliceLock {
    SpinLock  lock;
    CodUint16 xrmid;
    CodUint16 sharedCount;
} SliceLock;

```

1PB的数据，假设每个slice 1GB，则会有1M的slice，锁大小8B，需要8M内存。实现一个动态数组管理锁内存，最小申请空间为64个锁大小，之后拓展大小为64,128,256...4M。其内存从锁区中获取。

#####   [2. scan](#2-scan)  

​		delete 的scan与5.3的scan的流程一致，这里不再赘述。

#####   [3. lock rowid](#3-lock-rowid)  

​			当执行delete/delete时，需要锁行，由于我们使用的是slice级别的锁，行锁会被放大到slice级别。当需要	锁	行时，在slice上独占锁。

#####   [4.  coral delete](#4--coral-delete)  

######   [1） 记录delete 信息](#1-记录delete-信息)  

​		为了由于slice 的delete bitmap是整体加载，整体写入，为提高update效率，相同slice内的delete，不立即写入，只在执行上下文中记录哪些行被删除。

######   [2）合并delete bitmap](#2合并delete-bitmap)  

​		当扫描一个slice 完成，需要将执行上下文中记录的删除信息和delete bitmap合并，并序列化到一块buffer中。

######   [3） may drop slice](#3-may-drop-slice)  

​		可能删除完成后，整个slice 全部被删除，此时只需要将 slice 和swd中的元数据删除即可。

######   [4）update swd](#4update-swd)  

​		将序列化后delete bitmap 写入swd，如果slice被删除，直接将swd中的行删除。

#####   [5. invalid ac](#5-invalid-ac)  

​	当写入删除信息写入后，需要查ac映射表，获取slice对应的ac slice，将该slice删除。需为ac实现删除接口。

####   [5.3.3 Slice 回收](#533-slice-回收)  

​		一个slice中的数据被全部删除，或者ac 的slice 被置为invalid，可以将旧的slice删除。但是，直接删除会影响旧的查询，因此slice需要延迟删除。

​		使用系统表记录旧的slice和删除时间。新增后台任务，定期扫描系统表，清理保存时间大于undo retention的slice。当swd查到一个slice，但是slice文件不存在时报错snap shot too old 。

```
CREATE TABLE GARBAGE_SLICES$(
	DATAOID BIGINT,
	SLICE_ID BIGINT,
    BUCKET_ID INT,
	DELETE_TIME DATE
)ORGANIZATION HEAP SYSTEM;

```

###   [](#)  

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

​		以上模块中delete bitmap，coast 支持、swd升级和coral slice锁实现和ac失效都可以新增单元测试。

其他需要端到端测试。

##   [7. Document（资料）](#7-document资料)  

  [https://www.modb.pro/db/194049](https://www.modb.pro/db/194049)  

##   [8. Workload（工作量）](#8-workload工作量)  

![](https://pingcode.yasdb.com/atlas/files/public/67396afc8970c2af4f520070/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUNBQUFBQUFBQUFBQUFBQUNBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQVFBQUFBRUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA0OTgsImV4cCI6MTc4MjMwMTI5OH0.4GPW_V7d8IUkTGE4vbUtkKalM-m5Dr1kHy-R1O6-mlc)

##   [9. TODO（遗留问题）](#9-todo遗留问题)  

![](https://pingcode.yasdb.com/atlas/files/public/67396afc8970c2af4f52006e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUNBQUFBQUFBQUFBQUFBQUNBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQVFBQUFBRUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA0OTgsImV4cCI6MTc4MjMwMTI5OH0.4GPW_V7d8IUkTGE4vbUtkKalM-m5Dr1kHy-R1O6-mlc)

![](https://pingcode.yasdb.com/atlas/files/public/67396afc8970c2af4f520070/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUNBQUFBQUFBQUFBQUFBQUNBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQVFBQUFBRUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA0OTgsImV4cCI6MTc4MjMwMTI5OH0.4GPW_V7d8IUkTGE4vbUtkKalM-m5Dr1kHy-R1O6-mlc)

## Attachments:

[arch.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZmI4OTcwYzJhZjRmNTIwMDY2IiwicmVmX2lkIjoiNjczOTZhZmI3MjgyMDZlZmI5MmYwMDA1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNDk3LCJleHAiOjE3ODIzNzY4OTd9.JU_JJKgFNJKnCmTczpDOV3ohTFBTNqCBXFhWKQuYhqo)

 (image/png)    


[arch.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZmI4OTcwYzJhZjRmNTIwMDY3IiwicmVmX2lkIjoiNjczOTZhZmI3MjgyMDZlZmI5MmYwMDA1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNDk3LCJleHAiOjE3ODIzNzY4OTd9.b8ItYWpd30fm7XV5PmP3QG9p-UxFiHYmWU8CoHxGFGk)

 (image/png)    


[delete.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZmI4OTcwYzJhZjRmNTIwMDY4IiwicmVmX2lkIjoiNjczOTZhZmI3MjgyMDZlZmI5MmYwMDA1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNDk3LCJleHAiOjE3ODIzNzY4OTd9.CUwH7dSSleZLhZwJUfC-LcUtrlGhGDP4F9Qj3In8n5w)

 (image/png)    


[image2023-2-2_20-16-12.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZmI4OTcwYzJhZjRmNTIwMDY5IiwicmVmX2lkIjoiNjczOTZhZmI3MjgyMDZlZmI5MmYwMDA1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNDk3LCJleHAiOjE3ODIzNzY4OTd9.gdBfI3HkguC-1wxup6p7HOs-Ye61lDz8p2hYwtw9OGk)

 (image/png)    


[lob_delete_noblk.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZmJhMWFkOWEzMzExZGM3ZWRjIiwicmVmX2lkIjoiNjczOTZhZmI3MjgyMDZlZmI5MmYwMDA1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNDk3LCJleHAiOjE3ODIzNzY4OTd9.ki79LyK4tVKrS94ZyG5QMKGjZ-NSb6KAoTi48zt06YY)

 (image/png)    


[arch.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZmJhMWFkOWEzMzExZGM3ZWRkIiwicmVmX2lkIjoiNjczOTZhZmI3MjgyMDZlZmI5MmYwMDA1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNDk3LCJleHAiOjE3ODIzNzY4OTd9.Xz4hug4tButWRzeMAM0n9amgVTi6oKuaTbxYFa0A6v0)

 (image/png)    


[delete_bitmap.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZmJhMWFkOWEzMzExZGM3ZWRlIiwicmVmX2lkIjoiNjczOTZhZmI3MjgyMDZlZmI5MmYwMDA1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNDk3LCJleHAiOjE3ODIzNzY4OTd9.TGBalJ64qHkVAioZjNFGwPnyIZkU_YY58vEwt81NwjA)

 (image/png)    


[delete_bitmap.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZmJhMWFkOWEzMzExZGM3ZWRmIiwicmVmX2lkIjoiNjczOTZhZmI3MjgyMDZlZmI5MmYwMDA1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNDk3LCJleHAiOjE3ODIzNzY4OTd9.HTrQT9H_soPlViAENp1DhbFTeeFoGWzovCq7gNeWn3g)

 (image/png)    


[image2023-2-6_17-36-33.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZmI4OTcwYzJhZjRmNTIwMDZhIiwicmVmX2lkIjoiNjczOTZhZmI3MjgyMDZlZmI5MmYwMDA1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNDk3LCJleHAiOjE3ODIzNzY4OTd9.z6BjPmf_ttR8omiZmYr2J9aDKYPGP4N6IBF0sgAQ8Mc)

 (image/png)    


[细分依赖.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZmM4OTcwYzJhZjRmNTIwMDZiIiwicmVmX2lkIjoiNjczOTZhZmI3MjgyMDZlZmI5MmYwMDA1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNDk3LCJleHAiOjE3ODIzNzY4OTd9.VqoMVqShV1f5ji4BrfAivIFvgFWNwCfIKw2YfKZJB3Q)

 (image/png)    


[细分依赖.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZmNhMWFkOWEzMzExZGM3ZWUwIiwicmVmX2lkIjoiNjczOTZhZmI3MjgyMDZlZmI5MmYwMDA1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNDk3LCJleHAiOjE3ODIzNzY4OTd9.WjQysRO9KRm-R417kqoE-xWEYJg3AvxfcWCz_uqYhZk)

 (image/png)    


## Comments:

|  [](null)  ,1. 可能存在rowid物化，需要考虑该场景
1. update/delete不支持并行
1. 跨slice更新
1. 排序索引过滤做二分查找
1. 更新的slice 不是当前slice 场景，重建上下文。
,Posted by huangwenzao at 二月 06, 2023 15:11|
|---|
|  [](null)  ,bitmap设计可以更通用,Posted by huangwenzao at 二月 06, 2023 15:30|
|  [](null)  ,跨Slice更新删除有2种情况，一是记录从coral slice跨到vgd slice。二是slice被转换或合并，更新删除基于老的scn查询所能看到的slice发生了变化。,Posted by xierui at 二月 27, 2023 21:33|
|  [](null)  ,2023-3-17 讨论记录：,1，删除并发粒度，考虑支持更小的。2M记录粒度或过大。,2，slice延迟清除的时间与undo retension机制存在差异，可另外使用slice retesion等配置。,Posted by xierui at 三月 17, 2023 14:10|
|  [](null)  ,2023.3.30 DRB评审意见：,1，无任何删除时有快速路径的提前下，使用系统表存储方案保持后续兼容性，以支持更好的并发能力。,Posted by xierui at 三月 30, 2023 14:33|
