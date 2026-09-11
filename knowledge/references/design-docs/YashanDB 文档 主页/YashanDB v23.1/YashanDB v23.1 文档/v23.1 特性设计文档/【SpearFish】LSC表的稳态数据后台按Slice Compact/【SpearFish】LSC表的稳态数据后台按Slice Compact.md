Created by 万谦, last modified on 四月 25, 2023

#   [LSC表的稳态数据后台按Slice Compact](#lsc表的稳态数据后台按slice-compact)  

JIRA：    [YDBRD-11786](https://jira.yasdb.com/browse/YDBRD-11786)  

##   [1. Overview（概述）](#1-overview概述)  

目前系统中存在两种情况造成slice文件不便于使用：

（1）在rgd导入情况下，生成的slice文件未进行排序，后续对此slice的操作可能会因为过滤数据少而增加大量无效IO

（2）在强制转换情况下，生成的slice文件太小，离散IO问题严重

因此，此SR扩充了ALTER SLICE指令功能，使得用户可以对不合理的slice做compact，也支持后台在空闲时自动对系统内系统内的“残次”slice进行优化，提高性能

##   [2. Features（功能特性）](#2-features功能特性)  

1. slice的meta文件中记录是否排序标记，并提供视图进行查询
1. 新增SLICE_CCOMPACMPACT后台任务类型及具体的执行器
1. 提供alter slice compact语法
1. 优化优化后的slice文件通过anh_coast接口同步到备机
1. 延迟清理源文件（待定）


##   [3. Interfaces（接口）](#3-interfaces接口)  

```
// compact executor
CodResult compactSliceExec(AnkHandler* handler, Xfmr* xfmr);
CodVoid   compactSliceEnd(AnkHandler* handler, Xfmr* xfmr, CodResult ret);
// compact funcs
CodResult spfCompactSlicePrepare(AnkHandler* handler, Xfmr* xfmr);
CodResult spfCompactSliceExecute(AnkHandler* handler, Xfmr* xfmr);
CodResult spfCompactSliceRecord(AnkHandler* handler, Xfmr* xfmr);
CodResult spfCompactSliceFinish(AnkHandler* handler, Xfmr* xfmr);
CodVoid   spfCompactSliceEnd(AnkHandler* handler, Xfmr* xfmr);
CodVoid   spfCompactSliceClean(AnkHandler* handler, Xfmr* xfmr);
// force compact
CodResult spfForceXfmrTableSlice2Compact(AnkHandler* handler, TableDict* dc);

```

##   [4. Limitations（功能限制）](#4-limitations功能限制)  

只针对稳态数据

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 Architecture（架构）](#51-architecture架构)  

compact相关的解释见：

  [https://conf.yasdb.com/pages/viewpage.action?pageId=100093138](https://conf.yasdb.com/pages/viewpage.action?pageId=100093138)  

###   [5.2 Data Structures & Flow（数据结构与流程）](#52-data-structures--flow数据结构与流程)  

**修改lsc_slice_stat视图，增加sorted字段**

```
AnkColumn gV$LscSliceInfoCols[] = {
    DV_COLUMN_DEF("BO",                     BO,                        sizeof(CodUint64), DTYPE_BIGINT),
    DV_COLUMN_DEF("OBJ",                    OBJ,                       sizeof(CodUint64), DTYPE_BIGINT),
    DV_COLUMN_DEF("DATAOBJ",                DATAOBJ,                   sizeof(CodUint64), DTYPE_BIGINT),
    DV_COLUMN_DEF("SLICE_ID",               SLICE_ID,                  sizeof(CodUint64), DTYPE_BIGINT),
    DV_COLUMN_DEF("STATUS",                 STATUS,                    sizeof(CodUint32), DTYPE_INTEGER),
    DV_COLUMN_DEF("SORTED",                 SORTED,                    sizeof(CodBool),   DTYPE_BOOL),
    DV_COLUMN_DEF("SCN",                    SCN,                       sizeof(CodUint64), DTYPE_BIGINT),
    DV_COLUMN_DEF("SPACE_ID",               SPACE_ID,                  sizeof(CodUint32), DTYPE_INTEGER),
    DV_COLUMN_DEF("BUCKET_ID",              BUCKET_ID,                 sizeof(CodUint32), DTYPE_INTEGER),
    DV_COLUMN_DEF("SLICE_FILE_ID",          SLICE_FILE_ID,             sizeof(CodUint64), DTYPE_BIGINT),
    DV_COLUMN_DEF("FILE_SIZE",              FILE_SIZE,                 sizeof(CodUint64), DTYPE_BIGINT),
    DV_COLUMN_DEF("ROW_COUNT",              ROW_COUNT,                 sizeof(CodUint64), DTYPE_BIGINT),
    DV_COLUMN_DEF("ROW_GROUP_NUM",          ROW_GROUP_NUM,             sizeof(CodUint64), DTYPE_BIGINT),
};

```



**增加GARBAGE_DATA$系统表，记录将删除的数据信息**

```
CREATE TABLE GARBAGE_DATA$
(
    BO#             BINARY_BIGINT       NOT NULL,
    OBJ#            BINARY_BIGINT       NOT NULL,
    DATAOID#        BINARY_BIGINT       NOT NULL,
    TYPE            BINARY_INTEGER      NOT NULL,
    ENTRY           BINARY(1024)        NOT NULL,
    DELETE_TIME     BINARY_BIGINT       NOT NULL
) SYSTEM 162 ORGANIZATION HEAP
/
CREATE INDEX I_GARBAGE_DATA1 ON GARBAGE_DATA$(BO#)
/
CREATE INDEX I_GARBAGE_DATA2 ON GARBAGE_DATA$(OBJ#)
/
CREATE INDEX I_GARBAGE_DATA3 ON GARBAGE_DATA$(DATAOID#)
/

```

延迟清理数据的详细删除设计 等clean评审时介绍，此SR可以看到被compact的源slice文件的清理信息放置到了此系统表即可

**如何生成compact任务：**



上图生成compact任务执行流程：

1.发现1号slice需要compact，记录

2.发现2号slice需要compact，记录

3.发现3号slice需要compact，记录

4.发现4号slice不需compact，跳过

5.发现5号slice需要compact，记录

6.发现6号slice不需compact，跳过

7.发现7号slice需要compact，生成compact任务【compact slice7】

8.发现8号slice需要compact，生成compact任务【compact slice8】

9.发现9号slice需要compact，记录

10.发现10号slice需要compact，但是当前的记录数已超过slice_rows，生成compact任务【compact slice1,2,3,5,9】，重新记录slice10

11.发现11号slice需要compact，扫描结束，生成compact任务【compact slice10,11】

最终compact生成新slice12、slice13、slice14和slice15，原来的已经被compact的slice记录插入到garbage_file中，通过延迟清理最终删除

**提供alter slice compact能力**



alter slice compact含义：  **将当前所有的静态slice优化成可使用的slice（后台可能执行多轮，但前台返回时，当前对象的所有slice一定尽可能变成可用的slice）**

**其它说明：**

```
typedef enum EnXfmrType {
    TRANSFORM_SLICE = 0,
    CREATE_XFMR = 1,
    BUILD_AC = 2,
    CLEAN_FILE = 3,
    COMPACT_SLICE = 4,
    __XFMR_TYPE_COUNT__,
} XfmrType;

#define SPF_MAX_MERGE_SLICE_COUNT 32

```

（1）compact任务也持久化存在tabxfmr$系统表中，标识的type为4

（2）compact任务结束后删除的源slice对应的ac slice会无效

（3）后台在进行合并操作时处理的slice个数是有限制的，SPF_MAX_MERGE_SLICE_COUNT表示最多合并多少个“残次”slice，在slice文件情况较为极端时，后台自动合并生成的slice可能依然不合格，但是alter命令会等所有都合格才返回（最多会有一个最后的slice不满足要求）

（4）配置项更改：_COLUMNAR_SLICE_SORT_ROWS和_DATA_TRANSFORMERS都已删除

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

*设计开发人员自测用例（文字描述）。*

正常场景：

（1）基本语法、系统表和系统视图验证

（2）compact的基本功能

（3）打断后台XFMR能力（包括配置项控制和slice锁事务自发打断）

（4）ha同步的基本功能

（5）alter slice强制xfmr的基本功能

（6）无效ac slice的基本功能

极限场景：

（7）高并发，后台和dml并行执行

（8）资源不足 ①排序内存不足 ②databucket空间（磁盘空间）不足

（9）大量小或未排序slice场景

异常场景：

（10）频繁升主降备

（11）cancel/kill session下一致性保证

（12）ha主备断连等异常场景

##   [7. Workload（工作量）](#7-workload工作量)  

*评估代码量KLOC、工作量（人天）。*

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

*说明本方案遗留的问题或下一步需要解决的问题。*

## Attachments:

[image2023-4-4_15-3-53.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZmY4OTcwYzJhZjRmNTIwMDg2IiwicmVmX2lkIjoiNjczOTZhZmY3MjgyMDZlZmI5MmYwMDQ1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNTcwLCJleHAiOjE3ODIzNzY5NzB9.vle1WmVBagHI6g83MyWwTVCB6Mxp_B5Wi7LuhWyFx7c)

 (image/png)    


[image2023-4-4_15-4-4.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZmY4OTcwYzJhZjRmNTIwMDg4IiwicmVmX2lkIjoiNjczOTZhZmY3MjgyMDZlZmI5MmYwMDQ1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNTcwLCJleHAiOjE3ODIzNzY5NzB9.tywcqSthwCZWEmPOsbHUB7FvgqR5Yy--msuDS1Vyb2g)

 (image/png)    


[image2023-4-11_17-19-26.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZmZhMWFkOWEzMzExZGM3ZWZkIiwicmVmX2lkIjoiNjczOTZhZmY3MjgyMDZlZmI5MmYwMDQ1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNTcwLCJleHAiOjE3ODIzNzY5NzB9.aEfASjEpIikHHvt2Xg0Ynpng_s5dIgMSvSwETpiP1a0)

 (image/png)    


[image2023-4-11_17-59-25.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZmY4OTcwYzJhZjRmNTIwMDg5IiwicmVmX2lkIjoiNjczOTZhZmY3MjgyMDZlZmI5MmYwMDQ1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNTcwLCJleHAiOjE3ODIzNzY5NzB9.PD2f4wgMHXt8g8U5jPBB9Q3fWz5FPj72KxHyovOR2Zk)

 (image/png)    


[image2023-4-11_18-9-57.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZmZhMWFkOWEzMzExZGM3ZWZlIiwicmVmX2lkIjoiNjczOTZhZmY3MjgyMDZlZmI5MmYwMDQ1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNTcwLCJleHAiOjE3ODIzNzY5NzB9.iVwL53AtT2pfXvs5FU-9cXerl6LRuJ-4dDswB4KjMa8)

 (image/png)    


## Comments:

|  [](null)  ,2023年4月19日评审结论：,（1）sliceMeta中增加是否是compact生成的flag，  **lsc_slice_stat**  视图增加compact字段,（2）_COLUMNAR_SLICE_ROWS重命名为_MCOL_SLICE_ROWS，表示可变数据区内的slice数据量上限，可以在范围内随意调整,         新增可见配置项SCOL_SLICE_ROWS，用途是上述compact图示内作为静态slice的上限标识，只允许从小调大，默认值待定（8M？）,（3）alter slice命令扩展 alter_slice=ALTER TABLE "'table_name'" ALTER SLICE ALL (STABLE | COMPACT | CLEAN) [ASYNC].  省略ASYNC表示同步alter 去掉超时时间 直到alter完成或出错返回 ASYNC直接返回成功 后台自己去做对应的动作（另外，对外不暴露stable命令）,（4）提供控制后台任务执行的时间窗口，避免非预期内后台的自动执行（待讨论）,（5）vgd数据的clean逻辑也先回合,Posted by wanqian at 四月 19, 2023 12:00|
|---|
|  [](null)  ,2023年4月20日讨论（4）结论：,①增加全局配置项DATA_TRANSFORMER_ENABLED表示整个后台xfmr能否执行,②提供测试手段，扩展alter table enable语法 限制某张表的转换行为,![](https://pingcode.yasdb.com/atlas/files/public/67396affa1ad9a3311dc7f03/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQ0FBQUFBSUFCQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFnQUlBQWdBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBZ0lJQUFBQUFBQUFRQUFBQUFBQUFBQUFDQUFBQVFBQUFBQUFRQUFBQUJBQ0FBQUFBQUFBQUFBQ0FBQUFDQUFBQVFBQUFBQUlBQkFBQUFBQUFBZ0FBQUFBQUFBQUJBQUFRQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA1NzAsImV4cCI6MTc4MjMwMTM3MH0.BXWidGMxL3pl58XZkqFtPU5Foyjr-HBzYVNlDKhYNJU),![](https://pingcode.yasdb.com/atlas/files/public/67396aff8970c2af4f52008b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQ0FBQUFBSUFCQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFnQUlBQWdBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBZ0lJQUFBQUFBQUFRQUFBQUFBQUFBQUFDQUFBQVFBQUFBQUFRQUFBQUJBQ0FBQUFBQUFBQUFBQ0FBQUFDQUFBQVFBQUFBQUlBQkFBQUFBQUFBZ0FBQUFBQUFBQUJBQUFRQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA1NzAsImV4cCI6MTc4MjMwMTM3MH0.BXWidGMxL3pl58XZkqFtPU5Foyjr-HBzYVNlDKhYNJU),Posted by wanqian at 四月 20, 2023 18:37|
|  [](null)  ,2023年4月21日讨论结论：,（1）整体开关保留,（2）alter table的各种xfmr任务类型也对外暴露，用户可自己选择开启或暂停某张表的某些后台xfmr能力,![](https://pingcode.yasdb.com/atlas/files/public/67396aff8970c2af4f52008c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQ0FBQUFBSUFCQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFnQUlBQWdBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBZ0lJQUFBQUFBQUFRQUFBQUFBQUFBQUFDQUFBQVFBQUFBQUFRQUFBQUJBQ0FBQUFBQUFBQUFBQ0FBQUFDQUFBQVFBQUFBQUlBQkFBQUFBQUFBZ0FBQUFBQUFBQUJBQUFRQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA1NzAsImV4cCI6MTc4MjMwMTM3MH0.BXWidGMxL3pl58XZkqFtPU5Foyjr-HBzYVNlDKhYNJU),Posted by wanqian at 四月 21, 2023 18:14|
|  [](null)  ,语法图和配置上限：,![](https://pingcode.yasdb.com/atlas/files/public/67396affa1ad9a3311dc7f04/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQ0FBQUFBSUFCQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFnQUlBQWdBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBZ0lJQUFBQUFBQUFRQUFBQUFBQUFBQUFDQUFBQVFBQUFBQUFRQUFBQUJBQ0FBQUFBQUFBQUFBQ0FBQUFDQUFBQVFBQUFBQUlBQkFBQUFBQUFBZ0FBQUFBQUFBQUJBQUFRQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA1NzAsImV4cCI6MTc4MjMwMTM3MH0.BXWidGMxL3pl58XZkqFtPU5Foyjr-HBzYVNlDKhYNJU),  
,![](https://pingcode.yasdb.com/atlas/files/public/67396aff8970c2af4f52008d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQ0FBQUFBSUFCQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFnQUlBQWdBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBZ0lJQUFBQUFBQUFRQUFBQUFBQUFBQUFDQUFBQVFBQUFBQUFRQUFBQUJBQ0FBQUFBQUFBQUFBQ0FBQUFDQUFBQVFBQUFBQUlBQkFBQUFBQUFBZ0FBQUFBQUFBQUJBQUFRQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA1NzAsImV4cCI6MTc4MjMwMTM3MH0.BXWidGMxL3pl58XZkqFtPU5Foyjr-HBzYVNlDKhYNJU),一次合并的最大slice数量是32   SPF_MAX_MERGE_SLICE_COUNT ,scol_slice_rows上限目前暂定128M，默认值8M，并且只能调大,mcol_slice_row和之前范围保持一致,Posted by wanqian at 五月 19, 2023 09:19|
