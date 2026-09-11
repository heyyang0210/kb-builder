﻿﻿﻿

IR链接：

﻿  [ https://pingcode.yasdb.com/pjm/items/67064c886544792659b35b11?  ](https://pingcode.yasdb.com/pjm/items/67064c886544792659b35b11?)  #YDBRD-33625 开发任务：LSC表冷数据小批量导入优化

SR链接：

﻿  [ https://pingcode.yasdb.com/pjm/items/67064c88e489dd0868f2f1d9?  ](https://pingcode.yasdb.com/pjm/items/67064c88e489dd0868f2f1d9?)  #YDBRD-33624 LSC表冷数据支持导入时排序、合并

开发设计：

﻿  [ https://pingcode.yasdb.com/wiki/pages/677e277aea9f2a2870949d59 ](https://pingcode.yasdb.com/wiki/pages/677e277aea9f2a2870949d59)  ﻿

# 1. 概述

1. 在小批量导入场景下，可能出现非常多的小slice，后台xfmr任务始终无法跟上导入的情况。导致产生大量小slice，查询性能过低。
1. 当前根据3秒内产生slice个数达到一定量报错，来以防小slice过多，但还是难以解决该问题。


# 2. 需求分析

## 2.1 功能点分析

1. 增加隐藏参数 _SCOL_SLICE_FORCE_MERGE。当对象小slice达到该上限时，阻塞该对象部分dml操作直到slice进行compact操作。
1. 增加隐藏参数 _SCOL_TOTAL_COMPACT_TIME。用以配置时间参数，当多阶级合并slice阶段，时间达到此参数未有新的slice时，xmfr任务跨阶级合并。
1. 增加等待事件slice merge wait，表示一张表有dml阻塞。
1. 范围：


支持形态：单机，分布式

支持的表类型：LSC

## 2.2 应用场景



```
--主成功场景
```

```
导入大量的小slice，查询slice数量，达到_SCOL_SLICE_FORCE_MERGE设定值之后，有阻塞dml事件发生
```

```
等待一段时间slice数量会减少
```

```
当有大量的不同分级的slice时，等待超过设定时间，会跨阶级自动合并
```



## 2.3 规格约束

1._SCOL_SLICE_FORCE_MERGE，只判断小slice（小于128K,删除至128K的不算）的个数。

2.累计合并失败达到一定次数后报错，INFO级别，merge slice关键字。

# 3. 详细测试设计

## 3.1 测试设计方法

主要采用等价类划分，场景法组合进行设计

## 3.2 详细测试设计

1.功能测试测试点分析

||||
|---|---|---|
|输入条件|有效等价类|备注|
|_SCOL_SLICE_FORCE_MERGE参数值|[0,max(U32)]|有效范围外|
|_SCOL_TOTAL_COMPACT_TIME参数值|[0,max(U32)]|有效范围外|


2.场景测试分析

--

# 4. 测试用例

|||||
|---|---|---|---|
|用例编号|测试内容|预期|备注|
|1|_SCOL_SLICE_FORCE_MERGE参数有效值测试|查询参数默认值,设置参数范围外的值，报错,设置参数范围内的值，查询是否生效|﻿  
|
|2|_SCOL_TOTAL_COMPACT_TIME参数有效值测试|查询参数默认值,设置参数范围外的值，报错,设置参数范围内的值，查询是否生效|﻿  
|
|3|确认_SCOL_SLICE_FORCE_MERGE参数的有效性|当有导入slice任务发生后（slice大小各个级别的都存在），参数设定时间后，确认slice个数有减少，跨阶级合并生效|﻿  
|
|4|确认_SCOL_TOTAL_COMPACT_TIME参数有效性|导入大量小slice（行数小于128K），超过参数限制，确认该对象的dml是否被阻塞，有event事件，slice merge wait,过段时间，确认事件，事件会消失，且小slice数会减少|﻿  
|
|5|大slice超过_SCOL_SLICE_FORCE_MERGE，是否会阻塞|大slice超过参数限制，不会阻塞dml|﻿  
|
|6|删除大的slice至小slice，会在跨阶级合并时一起合并|删除到小于128K的不统计数量，会在跨阶级合并时一起合并|﻿  
|
|7|性能测试|导入生成大量小slice场景，同时并发查询，性能有优化|﻿  
|


性能场景；

1.关闭mcol，关闭compact，yasldr 导入lineitem表生成小slice，记录导入时间，并发查询小于128K slice数,查询 limeitem列。

性能测试版本：

1.需求合入前，对比 需求合入后，2T数据量，设置

|测试版本|数据量|_SCOL_SLICE_FORCE_MERGE参数值|导入时间|slice数|查询时间|slice数|查询时间|slice数|查询时间|
|---|---|---|---|---|---|---|---|---|---|
|代码合入前|150G|NA|﻿  
|﻿  
|﻿  
|﻿  
|﻿  
|﻿  
|﻿  
|
|代码合入后|150G|250|﻿  
|﻿  
|﻿  
|﻿  
|﻿  
|﻿  
|﻿  
|
|代码合入后|150G|400|﻿  
|﻿  
|﻿  
|﻿  
|﻿  
|﻿  
|﻿  
|
|代码合入后|150G|500|﻿  
|﻿  
|﻿  
|﻿  
|﻿  
|﻿  
|﻿  
|
|代码合入后|150G|600|﻿  
|﻿  
|﻿  
|﻿  
|﻿  
|﻿  
|﻿  
|
|代码合入后|150G|750|﻿  
|﻿  
|﻿  
|﻿  
|﻿  
|﻿  
|﻿  
|
|代码合入后|150G|1000|﻿  
|﻿  
|﻿  
|﻿  
|﻿  
|﻿  
|﻿  
|


# 5. 测试框架设计

使用现有Guider框架可满足功能。

# 6. 测试环境说明

|||
|---|---|
|服务器|﻿|
|操作系统|Linux|
|部署|单机、分布式|


# 7. 工作量评估

工作量：XX人天

1. 特性熟悉+测试调研 – 0.5天
1. 测试设计+评审 – 1.5天 
1. 测试用例 -  3天 
1. 执行用例+测试，性能测试 -  5天 
1. 上车分析 –  1天 


计划测试完成时间：2025/XX/XX

﻿  


sh run_v2.sh --yas_type tp --db_url 192.168.24.104:2688 --db_name yashan --db_home /data/ryf/yasdb/YASDB_HOME --table_type lsc --part_type hash --load_type yasldr --bus_type tpch --ctl_file_path ./sql/ctl/model/tpch/ --enable_bulk false --prepare --exec_test  --batch_size 256 --commit_rows 1 --mode batch --senders 2

/data/ryf/yasdb/YASDB_HOME/bin/yasldr tpch/tpch@192.168.24.104:2688 MODE=batch BATCH_SIZE=256 senders=2 csv_chunk_size=128 csv_line_size=126 CHARACTER_SET=utf8  control_file=/data/code_prj/yastest_dfx/perf_sa_import/sql/new/load_lineitem.sql



![image.png](https://pingcode.yasdb.com/atlas/files/public/67c812416a1ae92ae3736a4e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQWdBQUFCQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUVBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTk2OTIsImV4cCI6MTc4MjQ3MDQ5Mn0.rPjcylVxBA5zkMSiNJcYP4XGye6d5mcNNJmrCe3en3c)

