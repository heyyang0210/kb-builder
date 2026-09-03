Created by 李晶, last modified on 十一月 13, 2024

###   [1.1 竞品分析](https://pingcode.yasdb.com/wiki/spaces/YASDOC/draft-pages/674d54f1d2baff0fd559195b/edit)  

|产品名称|特性描述|功能优点|功能缺点|
|---|---|---|---|
|Doris|1. doris采用两层数据划分对数据进行管理：分区分桶。第一层是分区（Partition），支持 Range 和 List 的划分方式。第二层是 Bucket（Tablet），支持 Hash 和 Random 的划分方式。Tablet 是数据移动、复制等操作的最小物理存储单元 ，分区可以视为是逻辑上最小的管理单元 。
|1. 以保证桶大小优先的情况下，在建表参数合理的情况下性能较优。
|1. 先分区后再分布（分桶）在小表的情况下可能会导致数据分布不均，对数据的均衡性有影响。
|
|YashanDB|1. YashanDB 采用先分布后分区（Doris的分桶）的方式，且每个节点的分区数相差不超过1，根据合理的分布建进行分布,YashanDB一级分区支持Hash分区，二级分区支持Hash,Range,List 分区。
|1. 数据分布建合理的情况下数据的均衡性相比较好。
1. 不需要用户在建表的时候去执行分区大小，可用性相对较好。
|1. 一级分区数在建库时指定，无法灵活指定。
1. 由于数据分区数固定后，所以每一张表的最小分区数固定，表内的每个文件的大小无法保证，因而性能无法保证最优。
|


###   [1.2 原型验证](https://pingcode.yasdb.com/wiki/spaces/YASDOC/draft-pages/674d54f1d2baff0fd559195b/edit)  

扩展性  F

每节点最低并行  P

DN组数  N为变量

计算公式：chunk数=F * N * PN ~ FN

F = 2*P = 32

扩展因子初始值设置为：USERS_DATASPACE_SCALE_OUT_FACTOR = 32 

实际默认chunk数 = USERS_DATASPACE_SCALE_OUT_FACTOR * N(DN节点组数)



调整USERS_DATASPACE_SCALE_OUT_FACTOR（扩展因子）默认建库参数，

将默认chunk数量 由7*N（dn节点组数）扩展到 32*N（dn节点组数）。

```
1. 当默认分区数增大时，相应的随着并行度增加，TPCH 查询性能有明显提升。

2. 导数性能下降范围5%以内

3. DN导数性能200MB/s以上

```

###   [1.3 验证结果分析](https://pingcode.yasdb.com/wiki/spaces/YASDOC/draft-pages/674d54f1d2baff0fd559195b/edit)  

该需求主要根据调整默认扩展因子：USERS_DATASPACE_SCALE_OUT_FACTOR 为32，在相同条件（环境，数据量，组网）下，调整执行并行度时，相对查询性能有增长。

####   [测试组网：](#测试组网)  

```
 注释： 节点组数-每组下的节点数
hostid   | node_type | nodeid | pid    | instance_status | database_status | database_role | listen_address     | source_node | data_path
------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
 host0001 | mn        | 1-1:1  | 72249  | open            | normal          | primary       | 192.168.31.28:1678 | -           | /var/lib/jenkins/install/master_dst_tpch_lsc_copy_lmx/yashandb/data/mn-1-1
          +-----------+--------+--------+-----------------+-----------------+---------------+--------------------+-------------+----------------------------------------------------------------------------
          | cn        | 2-1:2  | 72345  | open            | normal          | primary       | 192.168.31.28:1688 | -           | /var/lib/jenkins/install/master_dst_tpch_lsc_copy_lmx/yashandb/data/cn-2-1
----------+-----------+--------+--------+-----------------+-----------------+---------------+--------------------+-------------+----------------------------------------------------------------------------
 host0002 | dn        | 3-1:3  | 38981  | open            | normal          | primary       | 192.168.31.29:1698 | -           | /var/lib/jenkins/install/master_dst_tpch_lsc_copy_lmx/yashandb/data/dn-3-1
----------+-----------+--------+--------+-----------------+-----------------+---------------+--------------------+-------------+----------------------------------------------------------------------------
 host0003 | dn        | 4-1:4  | 64555  | open            | normal          | primary       | 192.168.31.30:1698 | -           | /var/lib/jenkins/install/master_dst_tpch_lsc_copy_lmx/yashandb/data/dn-4-1
----------+-----------+--------+--------+-----------------+-----------------+---------------+--------------------+-------------+----------------------------------------------------------------------------
 host0004 | dn        | 5-1:5  | 474125 | open            | normal          | primary       | 192.168.31.31:1698 | -           | /var/lib/jenkins/install/master_dst_tpch_lsc_copy_lmx/yashandb/data/dn-5-1
```

####   [服务器配置](#服务器配置)  

```
 CPU核数： 128c，arm架构
 内存: 384G
 磁盘： 250以上（SSD/HDD）

```

####   [参数配置](https://pingcode.yasdb.com/wiki/spaces/LIJING/pages/673992c0728206efb9302a5e/edit)  

只描述与性能验证相关参数

```
REDO_FILE_SIZE = "2G" //与调整MAX_SESSIONS 参数相关
MAX_SEESIONS = "1124"
WORK_AREA_POOL_SIZE = "256M" //保证验证时拥有足够的内存使用

PQ_POOL_SIZE = "20G" //保证执行时足够的内存使用，防止并行度提升后因PQ_POOL_SIZE内存不足导致并行降级
MAX_PARALLEL_WORKERS = "1024" //防止设置并行度提升后因实际并行workers总数不足时导致并行降级
_CHN_MAX_SEGMENT_SIZE = "64k" //该参数不宜设置过大，会造成执行时PQ_POOL_SIZE 过大。

_PARALLEL_ADAPTIVE_MULTI_USER = FALSE //关闭并行自适应，设置为FALSE时，不会自适应并行度，参数不满足执行条件时会报错。

```

####   [相关参数调整说明](https://pingcode.yasdb.com/wiki/pages/67397440593f99c9ff23b481)  

注意：

出现并行度降级时：通过 gv$px_res_mgr视图观察并行worker数是否够用，够用的场景下需要调整PQ_POOL_SIZE

####   [TPCH100G性能验证结果](#tpch100g)  

|DEGREE_OF_PARALLEL（执行并行度）|7分区：热数据(首次执行)|7分区：热数据|7分区：冷数据（首次执行）|7分区：冷数据|16分区：热数据(首次执行)|16分区：热数据|16分区冷数据（首次执行）|16分区冷数据|32分区：热数据(首次执行)|32分区：热数据|32分区：冷数据（首次执行）|32分区：冷数据|64分区：热数据(首次执行)|64分区：热数据|64分区：冷数据（首次执行）|64分区：冷数据|
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
|16|46.267s|32.693s|20.291s|18.192s| 46.986s|33.774s|20.262s|18.200s|52.714s|34.690s|19.304s|16.984s|52.779s|35.984s|19.518s|17.224s|
|32|92.721s|80.879s|22.808|20.540s|47.818s|34.840s| 23.035s|20.649s|41.606s|24.120s|16.820s|14.046|40.291s|24.130s| 16.836s|14.237s|
|64|237.627s|235.539s|121.680s|103.284s|235.231s|207.530s|120.850s|101.259s|56.324s|39.580s|40.308s|32.913s|59.574s|38.968s|46.576s|33.024s|


![674c1c0ea1ad9a3311de3b65.png](https://pingcode.yasdb.com/atlas/files/public/674c1c16a1ad9a3311de3b66/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFJQUFBUUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBSUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUlBQUlBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQkFBQUFBUUFBUUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYwMTUsImV4cCI6MTc4MjQ2NjgxNX0.t6_iSDAgKnH5T9pWQNhyqJHf1CAyd4qmC1q_ihOsA3s)



![tpch100g_32.png](https://pingcode.yasdb.com/atlas/files/public/674c1c29a1ad9a3311de3b67/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFJQUFBUUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBSUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUlBQUlBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQkFBQUFBUUFBUUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYwMTUsImV4cCI6MTc4MjQ2NjgxNX0.t6_iSDAgKnH5T9pWQNhyqJHf1CAyd4qmC1q_ihOsA3s)



![TPCH100G_64并行度.png](https://pingcode.yasdb.com/atlas/files/public/674c1c3ca1ad9a3311de3b68/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFJQUFBUUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBSUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUlBQUlBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQkFBQUFBUUFBUUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYwMTUsImV4cCI6MTc4MjQ2NjgxNX0.t6_iSDAgKnH5T9pWQNhyqJHf1CAyd4qmC1q_ihOsA3s)



从实际性能验证的结果分析，tpch100G性能在各并行度的验证下，均以扩展因子值为32并行度验证最优。



####   [导数性能验证](#导数性能验证)  

#####   [场景一](#场景二)  

- table_type = lsc
- part_type = range
- csv_dir = /hdd_data2/data/120G
- sql_mode = batch
- sql_dir  =
- import_batch_size = 2048
- import_threads = 20
- check_result = y
- client_modes = yasldr
- enable_bulk = true


#####   [场景二](#场景三)  

- table_type = lsc
- part_type = range
- csv_dir = /hdd_data2/data/120G
- sql_mode = batch
- sql_dir  =
- import_batch_size = 2048
- import_threads = 128
- check_result = y
- client_modes =
- enable_bulk = true


#####   [场景三](#场景四)  

- table_type = lsc
- part_type = no
- csv_dir = /hdd_data2/data/120G
- sql_mode = batch
- sql_dir  =
- import_batch_size = 2048
- import_threads = 20
- check_result = y
- client_modes = yasldr
- enable_bulk = true


#####   [场景四](#场景五)  

- table_type = lsc
- part_type = no
- csv_dir = /hdd_data2/data/120G
- sql_mode = batch
- sql_dir  =
- import_batch_size = 2048
- import_threads = 128
- check_result = y
- client_modes =
- enable_bulk = true


#####   [场景五](#场景六)  

- table_type = lsc
- part_type = hash
- csv_dir = /hdd_data2/data/120G
- sql_mode = batch
- sql_dir  =
- import_batch_size = 2048
- import_threads = 20
- check_result = y
- client_modes = yasldr
- enable_bulk = true


#####   [场景六](#场景七)  

- table_type = lsc
- part_type = hash
- csv_dir = /hdd_data2/data/120G
- sql_mode = batch
- sql_dir  =
- import_batch_size = 2048
- import_threads = 128
- check_result = y
- client_modes =
- enable_bulk = true


|验证场景|7分区（MB/s）|32分区（MB/s）|性能下降（%）|64分区(MB/s)|性能下降（%）|
|---|---|---|---|---|---|
|场景一|73.59|61.76|16%|44.56|39.4%|
|场景二|81.57|73.04|10.5%|61.55|24.5%|
|场景三|98.49|76.86|22.7%|76.04|22.7%|
|场景四|100.33|89.85|9.6%|90.33|10.4%|
|场景五|75.36|73.06|3%|69.80|7.3%|
|场景六|93.92|90.60|3.5%|87.94|6.4%|


32 分区导入性能测试整体性能均对比64分区时性能要好，hash 分区的导入性能相对7分区下降区间在5%以内，为可控范围。由于分区数增加。

在导入场景下由于分区数增大，从存储上看slice会增多，每个slice 会变小，会直接影响导入的性能。导入时内存的需求也会同步上升。本需求是在各个性能指标下找到均衡的默认分区数。



从TPCH的在不同的并行度以及不同的分区数的验证数据结合导数的性能验证，将默认分区数建库参数修改为32。