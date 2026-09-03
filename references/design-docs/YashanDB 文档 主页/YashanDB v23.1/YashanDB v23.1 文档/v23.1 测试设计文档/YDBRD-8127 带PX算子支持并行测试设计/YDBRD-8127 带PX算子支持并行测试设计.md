Created by 董灵林, last modified on 十一月 13, 2023

# 1.   **概述**

在分布式场景下，支持带Px的算子也可以并行，包括HashJoin/HashGroup等，也就是这些算子的子节点包含了Px，也可以并行。

SR：    [YDBRD-8127](https://jira.yasdb.com/browse/YDBRD-8127?src=confmacro)    -  [列存支持] 带DXG的算子支持并行  完成

# 2.   **需求分析**

原本分布式下，数据从一个节点发生到其他节点后，因为节点间Queue只有一个，发送到远端节点后就不会再并行。

现在改为发送到远端之后根据cost还可以选择继续并行执行，详见：    [带Px算子支持并行](https://conf.yasdb.com/pages/viewpage.action?pageId=107384946)  

  


需求范围：分布式、列表

# 3.   **测试设计方法**

## 3.1 功能测试

带PX且支持并行的算子：group、hash join、aggr、union all、distinct、result

|大类|测试场景|备注|
|:---|:---|:---|
|算子|1、不带PX的算子不受影响,2、带PX的算子,    1）原来单机不支持并行              现在仍然不支持并行,    2）原来单机支持并行的算子       现在可以并行,        带px且支持并行的算子有：,               group,              hash join,              aggr,              union all,              distinct,              result,3、测试表类型：,    1）lsc、tac,    2）复制表、分布表,    3）非分区表、range分区、list分区、hash分区|举例,  
,  
,  
,  
,分区键与group key一致、不一致,hash join并行,非关联子查询并行,数据量千行以上，要比COLUMNAR_BULK_SIZE大（session级别）,  
,  
,复制表不走px,目前range分区、list分区不支持按分区并行,考虑hash分区单个分区键、多个分区键场景|
|性能|tpch优化需求需跑tpch性能|以tpch性能测试作为冒烟测试|


# 4.   **详细测试设计**

1）使用章节3的测试方法设计详细的测试点，可沿用xmind的方式

2）梳理该特性是否涉各个专项测试，并在详细设计中描述具体测试点

|专项|是否涉及|
|:---|:---|
|并发|是|
|长稳|  
|
|一致性|  
|
|三方测试工具    
  (sqltest，sqlancer)|  
|
|安全|  
|
|DFR/testkill|  
|
|HA|  
|
|压力|  
|
|性能|是|
|可维护性|  
|


# 5.   **测试用例**

测试设计细化后的文本用例

详见附件

|序号|用例名|测试点|
|:---|:---|:---|
|1|test_YDBRD8127_px_parallel_00_pre|预置数据|
|2|test_YDBRD8127_px_parallel_01_no_px|覆盖部分不带px的场景|
|3|test_YDBRD8127_px_parallel_02_group_single_01_duplicated_table|单表复制表group查询|
|4|test_YDBRD8127_px_parallel_03_group_single_02_sharded_table|单表分布表group查询|
|5|test_YDBRD8127_px_parallel_04_group_single_03_list_partition_table|单表list分区表group查询|
|6|test_YDBRD8127_px_parallel_05_group_single_04_range_partition_table|单表range分区表group查询|
|7|test_YDBRD8127_px_parallel_06_group_single_05_hash_partition_table01|单表hash单列分区表group查询|
|8|test_YDBRD8127_px_parallel_07_group_single_06_hash_partition_table02|单表hash多列分区表group查询|
|9|test_YDBRD8127_px_parallel_08_group_mutil_01_non_partition_join|非分区表多表group|
|10|test_YDBRD8127_px_parallel_09_group_mutil_02_list_partition_join|非分区表多表group|
|11|test_YDBRD8127_px_parallel_10_group_mutil_03_range_partition_join|range分区表join后group|
|12|test_YDBRD8127_px_parallel_11_group_mutil_04_hash_partition_join_01|hash单列分区表join后group|
|13|test_YDBRD8127_px_parallel_12_group_mutil_05_hash_partition_join_02|非分区表多表group|
|14|test_YDBRD8127_px_parallel_13_union_all|union all语句|
|15|test_YDBRD8127_px_parallel_14_union|union语句|
|16|test_YDBRD8127_px_parallel_15_correlated_subquery_exists|关联子查询 exists|
|17|test_YDBRD8127_px_parallel_16_correlated_subquery_not_exists|关联子查询 not exists|
|18|test_YDBRD8127_px_parallel_17_correlated_subquery_scalar_valued|关联子查询 标量子查询|
|19|test_YDBRD8127_px_parallel_18_non_correlated_subquery_all|非关联子查询all|
|20|test_YDBRD8127_px_parallel_19_non_correlated_subquery_any|非关联子查询any|
|21|test_YDBRD8127_px_parallel_20_non_correlated_subquery_in|非关联子查询in|
|22|test_YDBRD8127_px_parallel_21_non_correlated_subquery_not_in|非关联子查询not in|
|23|test_YDBRD8127_px_parallel_22_post|清理数据|


  


  


# 6.   **测试框架设计**

1. 如果用例不能实现自动化需要在此标注并说明原因
1. 如果需要使用新的测试框架实现用例的自动化，需要在此说明测试框架的架构逻辑及详细设计
1. 如果沿用已有测试框架，需要在此标注测试框架的路径


# 7.   **测试环境说明**

测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等