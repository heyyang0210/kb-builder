Created by 黄文早, last modified on 一月 03, 2024

#   [YDBRD-22612 : 优化存储侧分区与会话的内存分配](#ydbrd-22612--优化存储侧分区与会话的内存分配)  

##   [1. Overview（概述）](#1-overview概述)  

​ 目前，lsc 冷数据导入时，在多列场景下，需要分配较多的内存，在多分区，多并发时，导入需要的内存增大，一方面导致换入换出，另一方面内存使用过多会导致多分区，多并发场景下导入不可用，因此需要优化rgd 导入方案，减少内存损耗。

##   [2. Features（功能特性）](#2-features功能特性)  

1. rgd 方式导入边长内存不预占，用多少分配多少


##   [3. Interfaces（接口）](#3-interfaces接口)  

​ 无

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

​ 内存不足会换入换出，导致性能下降

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

当前Rgd 导入流程为：导入的数据每个分区都有两个Rgd，每个Rgd 上由一块buffer，当rgd 满之后，将生成一个写入任务，传给转换线程，转换线程负责将已经满的DataSet 向冷数据writer 中写入。

![](https://pingcode.yasdb.com/atlas/files/public/67396c64a1ad9a3311dc8a47/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFCQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQWdBQUFBQUFBQ0FBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBSUFBZ0FBQUFBQWdBQUFBQUFBQUFBQUFBUUFBQWdBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDA2MTIsImV4cCI6MTc4MjMxMTQxMn0.WulfZ2X9WXTCZC8ZIjN_EPD4tar5Lv9bDikF_aNN388)

###   [5.1优化点：修改DataSet变长数据内存管理方式](#51优化点修改dataset变长数据内存管理方式)  

######   [优化场景](#优化场景)  

​ 大宽表，多varchar，每一列定义的varchar 长度都很长，但是实际使用长度为只是很小一部分，多并发导入下，SCOL_DATA_BUFFER_SIZE内存不足，需要超配。

######   [原因分析 ](#原因分析)  

​ 当前Rgd 中 DataSet 内存分配，使用的是预占式分配，如果使用的是varchar 数据类型，内存分配时按照varchar 列定义的最大长度申请空间，造成空间浪费。

######   [优化方案](#优化方案)  

​ 变长列（varchar/lob）在DataSet中新增存储方式，列中存储指针和长度。DataSet 的变长列内存管理使用类似MemCtx结构，不断申请，大小为32K的block, 最后整体释放。现在mctx 模块与mpool 有耦合，与列存内存使用有差异，因此选择自己实现一套简单的内存分配，对列存allocator 进行简单包装。 最小分配单元定32K是为了满足一个lob 字段最多需要的内存。

######   [预期效果](#预期效果)  

​ rgd 缓存变长列内存用量与实际字段长度有关，于列定义长度无关。

###   [5.2 优化点：修改Rgd 分区缓存策略](#52-优化点修改rgd-分区缓存策略)  

######   [优化场景](#优化场景-1)  

​ 多分区导入，容易造成Rgd 内存不足报错。

######   [原因分析](#原因分析-1)  

​ 多个分区场景下每个分区都有两个rgd，每个rgd 内会缓存最多64K行数据，如果rgd 内存不足，会将数据直接写入coast writer，由于coast writer 内会缓存4096行数据，会导致占用COLUMNAR_VM_BUFFER内存，从而导入writer 内存不足，writer 内会频繁换入换出。

######   [优化方案](#优化方案-1)  

​ 1.调整一个RGD 最多可以缓存的内存数量上限为_COLUMNAR_ROWGROUP_ROWS，如果_COLUMNAR_ROWGROUP_ROWS小于64，则使用_COLUMNAR_ROWGROUP_ROWS的n 倍，并且保证n*_COLUMNAR_ROWGROUP_ROWS 大于64 (_COLUMNAR_ROWGROUP_ROWS  默认为4096）

​ 2. 对数据超过64行和小于64 行的DataSet，分别处理。直接获取所有权，将整个DataSet 数据放在Rgd中。对于小于64行的数据，会在每个rgd 中申请一个容量为64的dataset，将小于64行的数据复制到这个DataSet 中，缓存DataSet 满之后，创建新的DataSet。如果内存无法分配，将本线程中行数最多的分区，序列化到磁盘中。先序列化未满的rgd，每序列化一个rgd，重新尝试分配内存。如果序列化所有的内存后，依旧无法分配出足够内存，等待已满rgd 被后台刷盘，所有已满rgd刷盘完成后，内存不足则报错。由于每个DataSet只序列化一次，不会与writer一样，反复序列化。

​ 3. 序列化由写入线程做，反序列化由后台线程执行执行，反序列化时使用的内存分配器与rgd  导入线程使用相同的内存分配器，反序列化内存不足时，淘汰其他rgd 的数据。

######   [预期效果](#预期效果-1)  

​ rgd 导入内存超过满足最小内存需要时，不会报错。

###   [5.3 优化点：优化coast writer 使用内存](#53-优化点优化coast-writer-使用内存)  

######   [优化场景](#优化场景-2)  

​ 冷数据导入，writer 占用过大，造成COLUMNAR_VM_BUFFER 不足，并且容易造成writer 内换入换出。

######   [原因分析](#原因分析-2)  

​ 1. 目前writer 使用内存主要使用为：每列encoder 内存与 元数据统计的encoder 内存，元数据encoder 是PlainEncoder，在varchar 场景下会预分配512K内存，因为有min、max 两个encoder 统计，每列会预分配1M 内存。​ 2. writer 写入过程中，如果block 写不满，encoder 要一直打开，导致多分区场景下，encoder 内存使用 高。

######   [优化方法](#优化方法)  

​ 对于问题1，可以限制plain encoder 初始化分配的内存大小为4K，在内存不足时，再进行拓展。

​ 对于问题2，可以通过按block 写入，限制同时打开的encoder数量，rgd 中缓存数量到达一个block size 后再写入coast，并且写满一个block后立即刷盘，释放encoder，减少同时打开的encoder数量。

​ 旧写入方式：多行方式写入，block 满了再刷盘。

![](https://pingcode.yasdb.com/atlas/files/public/67396c648970c2af4f520bda/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFCQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQWdBQUFBQUFBQ0FBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBSUFBZ0FBQUFBQWdBQUFBQUFBQUFBQUFBUUFBQWdBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDA2MTIsImV4cCI6MTc4MjMxMTQxMn0.WulfZ2X9WXTCZC8ZIjN_EPD4tar5Lv9bDikF_aNN388)

​ 新写入方式：每列单独写，每列block 满了再刷盘。

![](https://pingcode.yasdb.com/atlas/files/public/67396c64a1ad9a3311dc8a48/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFCQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQWdBQUFBQUFBQ0FBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBSUFBZ0FBQUFBQWdBQUFBQUFBQUFBQUFBUUFBQWdBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDA2MTIsImV4cCI6MTc4MjMxMTQxMn0.WulfZ2X9WXTCZC8ZIjN_EPD4tar5Lv9bDikF_aNN388)

######   [预期效果](#预期效果-2)  

​ 减小rgd 导入性能最优时需要的内存下限。

###   [5.4 优化点：优化rgd 导入内存参数](#54-优化点优化rgd-导入内存参数)  

######   [优化场景](#优化场景-3)  

​ 导入过程中一个导入线程最大可用的内存配置计算为：

```
COLUMNAR_MATERIAL_PERCENT * COLUMNAR_VM_BUFFER_SIZE * columnar_max_operator_mem_percent * columnar_max_stage_mem_percent

```

用户配置复杂度高

######   [原因分析](#原因分析-3)  

​ 配额分配方式与列计算算子内存分配相同，但是导入与计算使用场景不一样，通过算子内存配置导入内存，不合理。

######   [优化方案](#优化方案-2)  

​ 提供隐藏配置项 COLUMNAR_MAX_BULKLOAD_MEM_PERCENT，控制Rgd 可用最大内存，占列存物化内存的上限。默认为100，最小值为1，最大值为100，所有rgd 导入使用列存的配额机制，在有rgd 导入时，每个导入线程会去拓展配额，存储侧会统计所有导入线程当前使用的内存配额，保证不超过总的配额限制。当达到总的配额限制，新的导入线程会等待，直到可以分配出导入需要的最小配额。

​ 并且rgd 导入使用columnar_vm_buffer 缓存数据，不使用SCOL_DATA_BUFFER，减小用户配置难度。

######   [预期效果](#预期效果-3)  

​ 用户导入只需要配置columnar_vm_buffer 就可以完成导入，而不用关心其他参数。

###   [5.6 DFX设计](#56-dfx设计)  

​ 增加rgd 导入耗时统计信息，换入换出耗时统计信息。

|字段                         |说明|
|---|---|
|SCOL BULKLOAD SWAP  BYTES|bulkload 换出字节大小|
|SCOL BULKLOAD SWAP TIME |bulkload 换入换出用时|
|SCOL BULKLOAD SWAP OUT CNT   |bulkload 换入换出次数|
|SCOL BULKLOAD TIME|bulkload 存储侧用时|
|SCOL BULKLOAD CNT|bulkload insert 次数|
|SCOL BULKLOAD COMMIT TIME|bulkload 提交用时，定位提交瓶颈|
|SCOL_SYNC_FILE_TIME|冷数据 写文件系统sync 文件用时|


​ 新增等待事件：SCOL_BULD_LOAD_QUOTA_WAIT 统计因为无法分配出最小quota 导致rgd 等待时间 

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

设计开发人员自测用例（文字描述），给出开发者自测试的设计方案表格或者XMIND、开发自测的用例归档路径。

自测关注点：

1. 覆盖全面
1. 避免重复测试
1. 测试用例的可维护性


自测用例设计方法：

1. 边界值
1. 等价类
1. 正交




增加rgd 模块自测用例

DataSet  新varchar类型列用例

大数据量，内存不足导入不报错用例

coast 按列写入接口ut 用例

coast 支持新varchar 列写入用例

##   [7.资料设计章节](#7资料设计章节)  

​ 调整资料中bulk load 导入使用指导，给出，不出现换入换出，每个线程需要的最小内存计算方式，以及，一个导入线程需要的最小内存计算方式。

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

## Attachments:

[OldWriter.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjRhMWFkOWEzMzExZGM4YTQ0IiwicmVmX2lkIjoiNjczOTZjNjQ3MjgyMDZlZmI5MmYxMWJlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNjExLCJleHAiOjE3ODIzODcwMTF9.FFbyw1CYaHufG41j6erc6KZspFM0JukHpT3kv3XEPHk)

 (image/png)    


[NewWriter.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjQ4OTcwYzJhZjRmNTIwYmQ5IiwicmVmX2lkIjoiNjczOTZjNjQ3MjgyMDZlZmI5MmYxMWJlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNjExLCJleHAiOjE3ODIzODcwMTF9._0bHJYjJ5ZrC5a5qs0K3-9whw7YMfhC8Nd73DeJn7X8)

 (image/png)    


## Comments:

|  [](null)  ,新增隐藏参数，控制导入内存占用 物化内存的百分比，,需要统计allocator 统计使用的内存（不包含碎片）    
    
  内存不足时后来的session等待 增加等待事件,评估内存大小最优的并发数    
  导入只使用columnar_vm_buffer,Posted by huangwenzao at 十一月 28, 2023 18:07|
|---|
|  [](null)  ,确认coast writer 内存占用    
  量化优化点解决的问题，量化优化效果    
  需要换出writer,评估单session 内最小需要的内存    
    
,Posted by huangwenzao at 十一月 28, 2023 18:35|
|  [](null)  ,由于分区拆分场景，服务端无法预估内存使用数量，  SCOL_BULD_LOAD_QUOTA_WAIT    等待时间不提供,Posted by huangwenzao at 一月 03, 2024 17:19|
