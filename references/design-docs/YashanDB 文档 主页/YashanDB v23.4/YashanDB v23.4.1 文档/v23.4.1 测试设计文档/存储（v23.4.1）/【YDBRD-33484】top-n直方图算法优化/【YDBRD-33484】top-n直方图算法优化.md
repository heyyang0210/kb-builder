

IR：#YDBRD-33484 top-n直方图算法优化   [https://pingcode.yasdb.com/pjm/items/67051984e489dd0868f21e79](https://pingcode.yasdb.com/pjm/items/67051984e489dd0868f21e79)  ?

开发设计：  [统计信息计算频率TopN优化](/pages/createpage.action?spaceKey=YAS&title=%E7%BB%9F%E8%AE%A1%E4%BF%A1%E6%81%AF%E8%AE%A1%E7%AE%97%E9%A2%91%E7%8E%87TopN%E4%BC%98%E5%8C%96)  

# 1. 概述

该需求来源于   [收集统计信息性能与统计信息质量分析 - 余睿杰 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=156107532)   中测试结论第三点，分析原因为 当采样率为1时，判断Precentage of rows for top n frequent values >=p时，需要先对出现频率Top N排序，在NDV远大于buckets时，该步骤比较耗时。

![](https://pingcode.yasdb.com/atlas/files/public/6738e43aa1ad9a3311dc37e0/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUVBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTkxNjIsImV4cCI6MTc4MjQ2OTk2Mn0._AzJ-vgyi-x8m8mjY9ayOBniK-dhuNXzzuBOiLWSslw)

t_bigdata_tocsv.py

# 2. 需求分析

## 2.1 功能点分析

**注意事项：**

1. 该需求测试的前提需满足：NDV > buckets, 采样率 estimate_percent =1；
1. 测试该前提条件下，  **收集topN或者混合直方图统计信息性能**  。
1. 影响性能的因素包含：列类型，topN出现频率分布，NDV和buckets大小关系。


**支持范围：**

1. 表类型：HEAP、TAC、LSC
1. 部署模式：单机、集群、分布式


## 2.2 应用场景

1. 导数后统计信息收集，例：exec DBMS_STATS.GATHER_TABLE_STATS('regress', 'table1', '', 1, FALSE, 'FOR COLUMNS col_int 10', 4, 'AUTO', TRUE);


## 2.3 规格约束

clob、blob不支持生成直方图

# 3. 详细测试设计

## 3.1 测试设计方法

1.主要采用等价类划分和场景覆盖法进行设计

- 不同类型影响性能，采用等价类划分分为普通列和宽列。
- 不同部署模式+不同表类型+不同类型+不同数据量：场景覆盖法


2.覆盖对象

|部署形态 |单机/集群/分布式|
|---|---|
|表类型|heap/lsc/tac|
|列类型|取：bigint，char（50） 和 char(2000)|
|NDV和bucket关系|NDV 取值为 3000左右，性能取1W,10W，100W,1000W等值，bucket取值10和2000|


## 3.2 详细测试设计

|验证点|验证场景|预期|说明|
|---|---|---|---|
|覆盖gather_table （表类型lsc，tac，heap）|bigint/float/date/nvarchar等列，,NDV数约为3000，bucket为10,采样为1，收集直方图,确认视图DBA_HISTOGRAMS|视图中，  ENDPOINT_NUMBER ，ENDPOINT_REPEAT_COUNT等字段显示正确|单机，分布式，集群|
|覆盖gather_schema |建多张表，采样率为1，收集直方图,确认视图DBA_HISTOGRAMS|视图中，  ENDPOINT_NUMBER ，ENDPOINT_REPEAT_COUNT等字段显示正确|单机，分布式，集群|
|覆盖gather_database|建多张表，采样率为1，收集直方图,确认视图DBA_HISTOGRAMS|视图中，  ENDPOINT_NUMBER ，ENDPOINT_REPEAT_COUNT等字段显示正确|单机，分布式，集群|
|NDV>bucket，采样率为1时，收集 列直方图性能|详见下方测试用例|收集统计性能有提升，极端场景下无改善持平|单机，分布式，集群|


  


# 4. 测试用例

1.冒烟用例

|SR编号|SR名称|用例编号|用例测试点|
|:---|:---|:---|:---|
|YDBRD-33484|top-n直方图算法优化|ydbrd_33484_histogram_opt_001|单机 heap 含有多列，采样率为1，NDV > bucket，收集直方图|
|YDBRD-33484|top-n直方图算法优化|ydbrd_33484_histogram_opt_002|分布式 lsc 含有多列，采样率为1，NDV > bucket，收集直方图|


2.文本用例

|用例测试点|预置条件(可选)|测试步骤(可选)|预期结果(可选)|
|---|---|---|---|
|GATHER_TABLE收集lsc列直方图|NDV > buckets,采样率 estimate_percent =1|1.建表，生成数据，导数  
2.gather_table方式收集直方图|查询视图DBA_HISTOGRAMS，字段结果正确|
|GATHER_TABLE收集heap列直方图|NDV > buckets,采样率 estimate_percent =1|1.建表，生成数据，导数  
2.gather_table方式收集直方图|查询视图DBA_HISTOGRAMS，字段结果正确|
|GATHER_TABLE收集tac直方图|NDV > buckets,采样率 estimate_percent =1|1.建表，生成数据，导数  
2.gather_table方式收集直方图|查询视图DBA_HISTOGRAMS，字段结果正确|
|GATHER_SCHEMA 单机 收集直方图|NDV > buckets,采样率 estimate_percent =1|1.建多种类型表，生成数据，导数  
2.gather_schema方式收集直方图|查询视图DBA_HISTOGRAMS，字段结果正确|
|GATHER_DATABAE单机 收集直方图|NDV > buckets,采样率 estimate_percent =1|1.建多种类型表，生成数据，导数  
2.gather_database方式收集直方图|查询视图DBA_HISTOGRAMS，字段结果正确|
|GATHER_SCHEMA 分布式 收集直方图|NDV > buckets,采样率 estimate_percent =1|1.建多种类型表，生成数据，导数  
2.gather_schema方式收集直方图|查询视图DBA_HISTOGRAMS，字段结果正确|
|GATHER_DATABAE分布式 收集直方图|NDV > buckets,采样率 estimate_percent =1|1.建多种类型表，生成数据，导数  
2.gather_database方式收集直方图|查询视图DBA_HISTOGRAMS，字段结果正确|
|GATHER_SCHEMA 集群 收集直方图|NDV > buckets,采样率 estimate_percent =1|1.建多种类型表，生成数据，导数  
2.gather_schema方式收集直方图|查询视图DBA_HISTOGRAMS，字段结果正确|
|GATHER_DATABAE 集群 收集直方图|NDV > buckets,采样率 estimate_percent =1|1.建多种类型表，生成数据，导数  
2.gather_database方式收集直方图|查询视图DBA_HISTOGRAMS，字段结果正确|


3.性能测试

性能测试场景设计：（指标：  **收集topN或者混合直方图统计信息时间**  ）只在单机

|列类型|NDV数|按列值大小排序后，出现频率分布|bucket数|测试项（首次收集时间）|多次收集时间平均值|使用数据文件名称|
|---|---|---|---|---|---|---|
|bigint|约10W|较小值出现频率高|2000|  
|  
|topn_10w_bigint_l|
|bigint|约10W|较小值出现频率高|10|  
|  
|topn_10w_bigint_l|
|char（50）|约10W|较小值出现频率高|2000|  
|  
|topn_10w_char20_l|
|char（50）|约10W|较小值出现频率高|10|  
|  
|topn_10w_char20_l|
|char（2000）|约10W|较小值出现频率高|2000|  
|  
|topn_10w_char2000_l|
|char（2000）|约10W|较小值出现频率高|10|  
|  
|topn_10w_char2000_l|
|bigint|约10W|较大值出现频率高|2000||  
|topn_10w_bigint_h|
|bigint|约10W|较大值出现频率高|10||  
|topn_10w_bigint_h|
|char（50）|约10W|较大值出现频率高|2000||  
|topn_10w_char20_h|
|char（50）|约10W|较大值出现频率高|10||  
|topn_10w_char20_h|
|char（2000）|约10W|较大值出现频率高|2000||  
|topn_10w_char2000_h|
|char（2000）|约10W|较大值出现频率高|10||  
|topn_10w_char2000_h|
|bigint|约10W|高频率值 随机分布|2000||  
|topn_10w_char2000_h|
|bigint|约10W|高频率值 随机分布|10||  
|topn_10w_char2000_h|
|char（50）|约10W|高频率值 随机分布|2000||  
|topn_10w_bigint_h|
|char（50）|约10W|高频率值 随机分布|10||  
|topn_10w_bigint_h|
|char（2000）|约10W|高频率值 随机分布|2000||  
|topn_10w_char20_h|
|char（2000）|约10W|高频率值 随机分布|10||  
|topn_10w_char20_h|
|bigint|约100W|较小值出现频率高|2000|  
|  
|topn_100w_bigint_l|
|bigint|约100W|较小值出现频率高|AUTO|  
|  
|topn_100w_bigint_l|
|char（50）|约100W|较小值出现频率高|2000|  
|  
|topn_100w_char20_l|
|char（50）|约100W|较小值出现频率高|AUTO|  
|  
|topn_100w_char20_l|
|char（2000）|约100W|较小值出现频率高|2000|  
|  
|topn_100w_char2000_l|
|char（2000）|约100W|较小值出现频率高|AUTO|  
|  
|topn_100w_char2000_l|
|bigint|约100W|较大值出现频率高|2000|  
|  
|topn_100w_bigint_h|
|bigint|约100W|较大值出现频率高|AUTO|  
|  
|topn_100w_bigint_h|
|char（50）|约100W|较大值出现频率高|2000|  
|  
|topn_100w_char20_h|
|char（50）|约100W|较大值出现频率高|AUTO|  
|  
|topn_100w_char20_h|
|char（2000）|约100W|较大值出现频率高|2000|  
|  
|topn_100w_char2000_h|
|char（2000）|约100W|较大值出现频率高|AUTO|  
|  
|topn_100w_char2000_h|
|bigint|约100W|高频率值 随机分布|2000|  
|  
|topn_100w_char2000_h|
|bigint|约100W|高频率值 随机分布|AUTO|  
|  
|topn_100w_char2000_h|
|char（50）|约100W|高频率值 随机分布|2000|  
|  
|topn_100w_bigint_h|
|char（50）|约100W|高频率值 随机分布|AUTO|  
|  
|topn_100w_bigint_h|
|char（2000）|约100W|高频率值 随机分布|2000|  
|  
|topn_100w_char20_h|
|char（2000）|约100W|高频率值 随机分布|AUTO|  
|  
|topn_100w_char20_h|
|bigint|约1000W|较小值出现频率高|2000|  
|  
|topn_1000w_bigint_l|
|bigint|约1000W|较小值出现频率高|AUTO|  
|  
|topn_1000w_bigint_l|
|char（50）|约1000W|较小值出现频率高|2000|  
|  
|topn_1000w_char20_l|
|char（50）|约1000W|较小值出现频率高|AUTO|  
|  
|topn_1000w_char20_l|
|char（2000）|约1000W|较小值出现频率高|2000|  
|  
|topn_1000w_char2000_l|
|char（2000）|约1000W|较小值出现频率高|AUTO|  
|  
|topn_1000w_char2000_l|
|bigint|约1000W|较大值出现频率高|2000|  
|  
|topn_1000w_bigint_h|
|bigint|约1000W|较大值出现频率高|AUTO|  
|  
|topn_1000w_bigint_h|
|char（50）|约1000W|较大值出现频率高|2000|  
|  
|topn_1000w_char20_h|
|char（50）|约1000W|较大值出现频率高|AUTO|  
|  
|topn_1000w_char20_h|
|char（2000）|约1000W|较大值出现频率高|2000|  
|  
|topn_1000w_char2000_h|
|char（2000）|约1000W|较大值出现频率高|AUTO|  
|  
|topn_1000w_char2000_h|
|bigint|约1000W|高频率值 随机分布|2000|  
|  
|topn_1000w_char2000_h|
|bigint|约1000W|高频率值 随机分布|AUTO|  
|  
|topn_1000w_char2000_h|
|char（50）|约1000W|高频率值 随机分布|2000|  
|  
|topn_1000w_bigint_h|
|char（50）|约1000W|高频率值 随机分布|AUTO|  
|  
|topn_1000w_bigint_h|
|char（2000）|约1000W|高频率值 随机分布|2000|  
|  
|topn_1000w_char20_h|
|char（2000）|约1000W|高频率值 随机分布|AUTO|  
|  
|topn_1000w_char20_h|


# 5. 测试框架设计

自动化用例，查视图部分的用例上架ytp

# 6. 测试环境说明

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|单机、分布式、集群|


# 7. 工作量评估

工作量：12  *人天*

1. 特性熟悉+测试调研 – 2天
1. 研发串讲、测试设计+评审 – 1天
1. 性能测试数据构造 – 1天
1. 文本用例+功能测试 - 2天
1. 性能测试 – 5天
1. 上车分析 – 1天


计划测试完成时间：2024/10/29

## Attachments:



 (image/png)  
