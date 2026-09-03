Created by 陈宜顺, last modified on 八月 05, 2023

  [https://jira.yasdb.com/browse/YDBRD-14028](https://jira.yasdb.com/browse/YDBRD-14028)  

##   [1. Overview（概述）](#1-overview概述)  

当前稳态数据模块内存使用存在以下几方面问题：

1. coast模块的writer内存消耗与字段个数相关，在大宽表场景很容易出现使用到达内存上限的情况，报COLUMNAR_VM_BUFFER不足
1. 字段如果涉及编码场景如字典编码、RLE编码、加密、压缩等，需要额外分配buffer，内存不足的情况会更加容易出现
1. 内存不足的场景可能涉及需要远超所在环境能提供的最大内存的总量，对用户来说基本就是不可用的状态。具体可粗略参考下面的计算公式。
1. bulkload方式导入需要分配SQL和coast之间的一块缓冲区内存，该内存使用也可能涉及过量内存分配，需要配置分配内存上限。


```
COLUMNAR_VM_BUFFER_SIZE &gt; (( 单行编码字段总长度 * 300K + 单行非编码字段总长度 * 4K ) *  表的分区数 * DOP)/ 0.8
SCOL_DATA_BUFFER_SIZE &gt; (128K * 单行长度 * 表的分区数 * DOP) / 0.8

```

##   [2. Features（功能特性）](#2-features功能特性)  

1. 导入/转换所需SCOL_DATA_BUFFER_SIZE可控，最小可设为配置项最小值。
1. 导入/转换所需COLUMNAR_VM_BUFFER_SIZE可控，单分区最低内存占用为1GB，小于则有可能在导入期间报错，大于则保证在没有其它负载的前提下，不会因为内存分配失败而报错。
1. 内存最小配置下不保证性能，过小可能影响导入速度，当出现影响导入速度的情况时在运行日志里面打印WARNING级别日志。


##   [3. Interfaces（接口）](#3-interfaces接口)  

1. 不涉及


##   [4. Limitations（功能限制）](#4-limitations功能限制)  

1. LSC的Bulkload导入/转换所需最小内存配置COLUMNAR_VM_BUFFER_SIZE = 1GB，小于不报错，但是有可能导入期间内存分配失败。
1. 内存最小配置下不保证性能
1. 最小内存配置仍然与DOP挂钩，最小内存配置需要指定DOP=2


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

**整体思路**  ：当内存不足时，采用  **换入换出**  的方式，把部分Bulkload期间暂时不用的缓冲区内存写到临时文件中，当需要使用时再换入内存来使用

###   [5.1 序列化](#51-序列化)  

####   [5.1.1 序列化文件格式](#511-序列化文件格式)  

序列化文件格式如下图所示，文件整体分为两部分，

第一部分为数据部分，由若干个序列化的Item组成，每个Item都有三部分，类型、数据长度以及实际数据的二进制字节流。

第二部分为元数据部分，也由三部分组成，customMeta用于存储一些定制化的元数据，具体解析由上层业务决定，默认可以为空；metaLen为定制化元数据的长度；itemCount为数据部分的item总数，用于提前计算所需内存。

![](https://pingcode.yasdb.com/atlas/files/public/67396afaa1ad9a3311dc7ed9/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQkFBQUFBQUFBQUVBQUFBQUFBQUFBQUFFQUFRQUFBQUFBQUFBZ0FBQUFBQUFBQ0FBQUFBQUFBQUFBQ0FBQUFBR0FBQUFBQUFCQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA0NTcsImV4cCI6MTc4MjMwMTI1N30.e1SQzm2iPzAq9WjPvZc80kE04aXVK3yTzuDby2qtP9A)

####   [5.1.2 序列化接口](#512-序列化接口)  

```
// serializer interface
CodResult cosOpenSerializer(CosSerializer* serializer, CodMemAllocator* allocator, const FileName serdeFileName,
                            CodUint64 metaSize, CodUint8** metaBuffer);
CodResult cosCloseSerializer(CosSerializer* serializer, CosSerializerCloseFlag flag);
CodResult cosSerializerWriteFile(CosSerializer* serializer, const CodUint8* data, CodUint64 size);
CodResult cosSerializerWriteItem(CosSerializer* serializer, CosSerdeItemType type, const CodUint8* object);

// deserializer interface
CodResult cosOpenDeserializer(CosDeserializer* deserializer, CodMemAllocator* allocator, FileName serdeFileName,
                              const CodUint8** metaBuffer);
CodVoid   cosCloseDeserializer(CosDeserializer* deserializer);
CodResult cosDeserializerReadFile(CosDeserializer* deserializer, CodUint8* buffer, CodUint64 length,
                                  CodUint64* actualSize);
CodResult cosDeserializerReadItem(CosDeserializer* deserializer, CosDeserializedItem* item);
CodVoid   cosReleaseDeserializedItem(CosDeserializedItem* item);
CodResult cosGetDeserializedItem(CosDeserializedItemList* list, CosSerdeItemType type, CosDeserializedItem** item);

```

接口使用方式举例：

```
// 序列化
cosOpenSerializer；// 打开序列化对象，如果有customMeta，则填入metaSize，返回metaBuffer给用户
for (i: itemCount) {
    cosSerializerWriteItem;// 写入多个序列化item
}
cosCloseSerializer;//关闭序列化对象，会往文件末尾追加元数据部分

// 反序列化
cosOpenDeserializer; // 打开反序列化对象，如果有customMeta，则返回metaBuffer给用户
for (i: itemCount) {
    cosSerializerWriteItem;// 读取多个反序列化item
}
cosGetDeserializedItem；//按需取出每个反序列化item
cosReleaseDeserializedItem；//销毁

```

###   [5.2 换入换出算法](#52-换入换出算法)  

淘汰（换出）顺序如下图所示，假如是ColumnWriter3内存不足产生淘汰请求，则优先淘汰ColumnWriter2，再淘汰ColumnWriter1，一次类推，直到循环淘汰到ColumnWriter4为止。

显然，算法使用FIFO原则，优先淘汰上一次使用的Writer，因为写入一般是从第一列写到最后一列，循环执行的，上一次使用过的ColumnWriter，轮到下次使用的时间最长，所以优先淘汰，这样产生总的淘汰次数是最少的。

![](https://pingcode.yasdb.com/atlas/files/public/67396afaa1ad9a3311dc7eda/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQkFBQUFBQUFBQUVBQUFBQUFBQUFBQUFFQUFRQUFBQUFBQUFBZ0FBQUFBQUFBQ0FBQUFBQUFBQUFBQ0FBQUFBR0FBQUFBQUFCQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA0NTcsImV4cCI6MTc4MjMwMTI1N30.e1SQzm2iPzAq9WjPvZc80kE04aXVK3yTzuDby2qtP9A)

换入原则：在每次ColumnWriter产生写入操作前，如果检查到被换出过，先尝试进行换入操作。

![](https://pingcode.yasdb.com/atlas/files/public/67396afa8970c2af4f520065/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQkFBQUFBQUFBQUVBQUFBQUFBQUFBQUFFQUFRQUFBQUFBQUFBZ0FBQUFBQUFBQ0FBQUFBQUFBQUFBQ0FBQUFBR0FBQUFBQUFCQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA0NTcsImV4cCI6MTc4MjMwMTI1N30.e1SQzm2iPzAq9WjPvZc80kE04aXVK3yTzuDby2qtP9A)

####   [5.2.1 需要换入换出的数据](#521-需要换入换出的数据)  

1. Encoder上的encodedBlock
1. 字典编码上的字典数据
1. 其它


###   [5.2.2 换入换出的编码类型](#522-换入换出的编码类型)  

|编码类型|是否支持换入换出|备注|
|---|---|---|
|CODEC_PLAIN|支持||
|CODEC_DICT_AUX|支持||
|CODEC_DICT_PLAIN|支持||
|CODEC_DICT|支持||
|CODEC_BIT_RLE_HYBRID|不支持|仅INT和BIGINT需要支持RLE，单列最大内存占用约21K，换入换出代价大，且内存节省效果不明显|
|CODEC_BOOL|不支持|Bool类型占用内存少，单列只需要512字节（4000/8）的缓冲区，换入换出代价大，且内存节省效果不明显|
|CODEC_NUMBER|不支持|Buffer占用最多是4K * 20 * 4K = 320MB，在可控范围内，不需要换入换出|


换入换出的数据选定原则：不是所有数据都需要换入换出，尽可能选择大块内存进行淘汰，小块内存尽可能不淘汰，减少换入换出带来的IO开销。

###   [5.3 Bulkload时的buffer处理](#53-bulkload时的buffer处理)  

当前Bulkload导入时，需要为Bulkload的线程先申请一块能容纳64KB行的缓冲区，当SCOL_DATA_BUFFER内存不足时，会减少申请内存的大小，直到64行记录都容纳不下为止，才返回报错。

为了保证SCOL_DATA_BUFFER不会出现不足的情况，如果SCOL_DATA_BUFFER_SIZE < 4G, 不再尝试申请内存，直接使用Cursor上的dataset，调用coast的Writer接口写入Slice文件。同时也不再产生task任务，转单线程写入处理，写入性能可能有所下降。

###   [5.4 观测手段](#54-观测手段)  

v$sysstat新增7个统计值：

```
[cys@AchorBase anchorbase]$ rlwrap $YASDB_HOME/bin/yasql sys/Cod-2022@127.0.0.1:1688 -c "select * from v\$sysstat where name like 'SCOL SWAP%' or name like 'SCOL BULKLOAD%'" 

  STATISTIC# NAME                                                                    CLASS                 VALUE 
------------ ---------------------------------------------------------------- ------------ --------------------- 
         432 SCOL SWAP OUT CNT                                                           8                 11183
         433 SCOL SWAP IN CNT                                                            8                  7924
         434 SCOL SWAP OUT WRITE BYTES                                                   8           30084929063
         435 SCOL SWAP IN READ BYTES                                                     8          103376678319
         436 SCOL SWAP OUT FREE BYTES                                                    8          115806799440
         437 SCOL SWAP IN ALLOC BYTES                                                    8                     0
         438 SCOL BULKLOAD WRITE SYNC CNT                                                8                     1

7 rows fetched.

```

|名称|统计项含义|统计意义|
|---|---|---|
|SCOL SWAP OUT CNT|导入/后台转换过程中因COLUMNAR_VM_BUFFER不足而产生的换出次数|单位时间内增长的速度越快，导入速度越慢，调大COLUMNAR_VM_BUFFER_SIZE可缓解|
|SCOL SWAP IN CNT|导入/后台转换过程中因COLUMNAR_VM_BUFFER不足而产生的换入次数|单位时间内增长的速度越快，导入速度越慢，调大COLUMNAR_VM_BUFFER_SIZE可缓解|
|SCOL SWAP OUT WRITE BYTES|导入/后台转换过程中因COLUMNAR_VM_BUFFER不足而产生的写盘字节数|单位时间内增长的速度越快，导入速度越慢，调大COLUMNAR_VM_BUFFER_SIZE可缓解|
|SCOL SWAP IN READ BYTES|导入/后台转换过程中因COLUMNAR_VM_BUFFER不足而产生的读盘字节数|单位时间内增长的速度越快，导入速度越慢，调大COLUMNAR_VM_BUFFER_SIZE可缓解|
|SCOL SWAP OUT FREE BYTES|导入/后台转换过程中换出释放的COLUMNAR_VM_BUFFER字节数|单位时间内增长的速度越快，导入速度越慢，调大COLUMNAR_VM_BUFFER_SIZE可缓解|
|SCOL SWAP IN ALLOC BYTES|导入/后台转换过程中换入申请的COLUMNAR_VM_BUFFER字节数|单位时间内增长的速度越快，导入速度越慢，调大COLUMNAR_VM_BUFFER_SIZE可缓解|
|SCOL BULKLOAD WRITE SYNC CNT|导入/后台转换过程中因SCOL_DATA_BUFFER不足产生的同步写次数|单位时间内增长的速度越快，导入速度越慢，调大SCOL_DATA_BUFFER_SIZE可缓解|


##   [6. Testcases（自测用例）](#6-testcases自测用例)  

1. 普通场景：TPCH的导入能达到100M/s
1. 极端场景：4096个字典编码的varchar(8000)，单分区单导入线程，最小内存配置，可以导入成功
1. 极端场景：4096个PLAIN编码的CLOB/JSON，单分区单导入线程，最小内存配置，可以导入成功
1. 加上端到端脚本能力后，4096个字典编码的varchar(8000)，1M分区单线程，最小内存配置，可以导入成功


##   [7. Workload（工作量）](#7-workload工作量)  

评估代码量KLOC、工作量（人天）。

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

说明本方案遗留的问题或下一步需要解决的问题。

1. 写入线程数可控：YDBRD-10854


##   [9. 附录](#9-附录)  

附前期讨论的信息：

  [LSC表bulkload导入改进点讨论](https://conf.yasdb.com/pages/viewpage.action?pageId=104210364)  

## Attachments:

[image2023-3-8_9-51-54.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZjlhMWFkOWEzMzExZGM3ZWQ3IiwicmVmX2lkIjoiNjczOTZhZjk1OTNmOTljOWZmMjM1YmU2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNDU3LCJleHAiOjE3ODIzNzY4NTd9.HBSJy_6NP7AU-14rj41hwXY6-r3Wv7etVG2t8NzNUAs)

 (image/png)    


[image2023-3-8_9-58-21.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZmE4OTcwYzJhZjRmNTIwMDVlIiwicmVmX2lkIjoiNjczOTZhZjk1OTNmOTljOWZmMjM1YmU2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNDU3LCJleHAiOjE3ODIzNzY4NTd9.uVpvQOsZlxuVn_WrAe_aHfdLozjWILmS6sPPNLVIiuE)

 (image/png)    


[image2023-6-19_11-10-40.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZmE4OTcwYzJhZjRmNTIwMDVmIiwicmVmX2lkIjoiNjczOTZhZjk1OTNmOTljOWZmMjM1YmU2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNDU3LCJleHAiOjE3ODIzNzY4NTd9.Oa4xGBPUvejIaNYO-ENBLswYmuQFATjX5wbNjUmFP74)

 (image/png)    


[image2023-6-19_16-57-34.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZmFhMWFkOWEzMzExZGM3ZWQ4IiwicmVmX2lkIjoiNjczOTZhZjk1OTNmOTljOWZmMjM1YmU2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNDU3LCJleHAiOjE3ODIzNzY4NTd9.ErhHuwyy3U4wOqJIFBCqB8UWnZYf-I9I_uEzinkElms)

 (image/png)    


[image2023-6-19_17-13-32.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZmE4OTcwYzJhZjRmNTIwMDYwIiwicmVmX2lkIjoiNjczOTZhZjk1OTNmOTljOWZmMjM1YmU2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNDU3LCJleHAiOjE3ODIzNzY4NTd9.1VIb1UaYO_AqfrBo_YejcaKz-bpyd0QdT8GC-9kyQyQ)

 (image/png)    


[image2023-6-19_17-23-34.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZmE4OTcwYzJhZjRmNTIwMDYxIiwicmVmX2lkIjoiNjczOTZhZjk1OTNmOTljOWZmMjM1YmU2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNDU3LCJleHAiOjE3ODIzNzY4NTd9.KrgPUDbCS6fpy-fMjJ8_ntiP57b9B-lcxwSVX2TMjyQ)

 (image/png)    


## Comments:

|  [](null)  ,1. _BULKLOAD_MAX_PART_NUM保留，取值范围[1,1M], 隐藏配置项，默认1，测试兼容场景打开。由工具端读SCOL_DATA_BUFFER_SIZE确定起多少个进程
1. 存储需要提供interval分区的计算公式给分区拆分工具
1. 分布式场景，分区拆分工具在客户端侧拆分，然后工具把拆分的文件拷贝到DN然后直连DN导入，或者直连到DN执行命令从客户端获取csv文件进行导入。
1. 单机场景下，分区拆分工具在客户端侧拆分，然后工具直接调用loader命令导入拆分后的CSV文件。
1. 提供资料说明bulkload和非bulkload适用场景
,遗留问题：是否需要支持单机的LSC的interval分区？,Posted by chenyishun at 三月 07, 2023 20:20|
|---|
|  [](null)  ,开发计划：,1. 3月13日工具和存储联调，工具先转测
1. 3月17日端到端转测，测性能
,Posted by chenyishun at 三月 07, 2023 20:29|
|  [](null)  ,writer提供swap能力,rgd可以不用dataset，直接用writer写,extent处理,Posted by chenyishun at 六月 19, 2023 19:55|
