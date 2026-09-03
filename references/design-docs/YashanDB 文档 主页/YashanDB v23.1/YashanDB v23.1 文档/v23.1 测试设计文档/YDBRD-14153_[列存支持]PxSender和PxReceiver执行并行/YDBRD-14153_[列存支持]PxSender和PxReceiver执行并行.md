Created by 董灵林, last modified on 十一月 13, 2023

# 1.   **概述**

当前Stage在多个节点执行，其是基于分片进行并行的而Stage内部是基于分区进行并行的。当前stage 发送数据都是要合并成一个线程后发送，到达接收端之后，只有一个线程接收，接收完成之后，如果要并行，就要再次分发给并行线程。对外呈现就是Stage在一个节点内部并行实现全并行，因为stage的sender和receiver都 没有并行。本方案就是要解决stage全并发，并且减少数据的重分发。

SR：    [YDBRD-14153](https://jira.yasdb.com/browse/YDBRD-14153?src=confmacro)    -  [列存支持]PxSender和PxReceiver执行并行  完成

# 2.   **需求分析**

原本分布式节点到节点间数据分发只有一个QUEUE，现在可以直接线程到线程分发，详见：    [PxSender和PxReceiver支持并行](119556490.html)  

  


需求范围：单机、分布式

# 3.   **测试设计方法**

|大类|测试场景|备注|
|:---|:---|:---|
|分布式|  
,1、表类型,        1）复制表,        2）分布表,            非分区表、hash分区、range分区、interval分区、list分区、二级分区,            单个分布键、多个分布键,2、分发方式,         1）hash group,         2）hash join,         3）hash group、hash join在SQL中位置,         4）分布键、分区键字段类型覆盖,3、并行度,    1）并行度取值,         并行度<=0，报错,         并行度=1，非并行,         1<并行度<=255，并行执行,         并行度>255，报错,  
|  
,  
,  
,  
,  
,  
,当前多个分布键一律采用remete分发,  
|
|性能|在  YDBRD-13275合入后，  tpch性能不能下降|  
|
|上车|将二层所有功能用例开启degree_of_parallel=2执行一遍|  
|


# 4.   **详细测试设计**

1）使用章节3的测试方法设计详细的测试点，可沿用xmind的方式

2）梳理该特性是否涉各个专项测试，并在详细设计中描述具体测试点

|专项|是否涉及|
|:---|:---|
|并发|是|
|长稳|是|
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

|序号|文件名|测试点|
|---|---|---|
|1|test_YDBRD14153_pxSender_pxReceiver_pre|预置数据|
|2|test_YDBRD14153_pxSender_pxReceiver_01|hash group分发方式：1复制表，2.非分区表|
|3|test_YDBRD14153_pxSender_pxReceiver_02|hash group分发方式：3.1 hash分区表，分布键是group key的子集 + 分区键也是group key的子集|
|4|test_YDBRD14153_pxSender_pxReceiver_03|hash group分发方式：3.2 hash分区表，分布键是group key的子集 + 分区键不是group key的子集|
|5|test_YDBRD14153_pxSender_pxReceiver_04|hash group分发方式：3.3 hash分区表，分布键不是group key的子集 + 分区键是group key的子集|
|6|test_YDBRD14153_pxSender_pxReceiver_05|hash group分发方式：3.4 hash分区表，分布键不是group key的子集 + 分区键不是group key的子集|
|7|test_YDBRD14153_pxSender_pxReceiver_06|hash join分发方式：1. 复制表 + 非分区表|
|8|test_YDBRD14153_pxSender_pxReceiver_07|hash join分发方式：2. 复制表 + 分区表|
|9|test_YDBRD14153_pxSender_pxReceiver_08|hash join分发方式：3. 非分区表 + 分区表|
|10|test_YDBRD14153_pxSender_pxReceiver_09|hash join分发方式：4. 分区表 + 分区表|
|11|test_YDBRD14153_pxSender_pxReceiver_10|hash join + hash group|
|12|test_YDBRD14153_pxSender_pxReceiver_11|hash join、hash group作为子查询|
|13|test_YDBRD14153_pxSender_pxReceiver_12|hash join连接多个表|
|14|test_YDBRD14153_pxSender_pxReceiver_13|覆盖只能remote分发的分区类型：1 range分区表，2 list分区表|
|15|test_YDBRD14153_pxSender_pxReceiver_14|覆盖只能remote分发的分区类型：3 二级分区表；4 多个分布键|
|16|test_YDBRD14153_pxSender_pxReceiver_15|资源不足场景测试|
|17|test_YDBRD14153_pxSender_pxReceiver_16|并行度较大+数据量较多的场景|
|18|test_YDBRD14153_pxSender_pxReceiver_17|与23.1相关特性交互场景|
|19|test_YDBRD14153_pxSender_pxReceiver_post|清理数据|


  


  


# 6.   **测试框架设计**

1. 如果用例不能实现自动化需要在此标注并说明原因
1. 如果需要使用新的测试框架实现用例的自动化，需要在此说明测试框架的架构逻辑及详细设计
1. 如果沿用已有测试框架，需要在此标注测试框架的路径


# 7.   **测试环境说明**

测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等

## Attachments:

[YDBRD-14153 [列存支持]PxSender和PxReceiver执行并行.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5OTU4OTcwYzJhZjRmNTFmOTMwIiwicmVmX2lkIjoiNjczOTY5OTQ3MjgyMDZlZmI5MmVmNGFhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3NDQ2LCJleHAiOjE3ODIyOTM4NDZ9.PSITftbvRuLheqE-A4aONGUT2t3U7epHcIYm5EVZz1g)

 (application/x-xmind)    
