Created by 施新华 on 十一月 14, 2023

# 1.   **概述**

分布式及单机设置并行度时

1、补齐  算子级别 px 信息统计的 autotrace 信息

2、补齐执行级别统计信息的 network io 的 autotrace 信息

SR：    [YDBRD-13063](https://jira.yasdb.com/browse/YDBRD-13063?src=confmacro)    -  autotrace支持输出分布式执行计划等信息  完成

# 2.   **需求分析**

- 功能


          分布式及单机设置并行度时

          1、补齐  算子级别 px 信息统计的 autotrace 信息

          2、补齐执行级别统计信息的 network io 的 autotrace 信息

- 外部接口


           打开 autotrace 后，在 autotrace 信息中展示；

- 功能约束


           统计的网络io只包括经过PX的数据消息大小，不包含lob数据以及控制消息

           单机 px local 算子，只统计 heap 表，列表无数据显示

- 实现流程


见开发设计文档     [antotrace支持输出分布式执行计划等信息 - 秦湫婷 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=122068084)  

# 3.   **测试设计方法**

使用场景测试，结合等价类、边界值进行测试设计。

测试策略：1、关注本 sr 功能；2、三层有 autotrace 的用例，可以复用用来覆盖对基线功能的影响

功能测试：

1、分布式上，分别构造并行线程及节点上的 N2N、N2I、I2N、I2I 的 px remote 算子，观察 px 算子及 network io 的统计信息；

2、单机上，构造并行线程上的 N2N、N2I、I2N、I2I 的 px local 算子，观察 px 算子及 network io 的统计信息；

性能测试：比对 master 与 sr 分支，开启/关闭 autotrace 对 tpch 的影响程度；无量化指标，主观判断

# 4.   **详细测试设计**

1）使用章节3的测试方法设计详细的测试点，可沿用xmind的方式

- 功能测试


          1、分布式上，分别构造并行线程及节点上的 N2N、N2I、I2N、I2I 的 px remote 算子，观察 autotrace 信息： px 算子及 network io 的统计信息；----- TPCH 上有大量的这种算子可供参考

          2、单机上，构造并行线程上的 N2N、N2I、I2N、I2I 的 px local 算子，观察autotrace 信息： px 算子及 network io 的统计信息;

          3、数据类型考虑：int、varchar、lob

          4、表类型覆盖：lsc、tac、heap 表中挑选典型用例来覆盖

          5、主备部署模式下，px 算子展示主备节点，network io 汇总主备节点 ---业务数据在备节点上无统计数据，动态视图有数据展示；dv$channel 视图；---备节点上数据可能测试不到，待确认

          6、开启system级别的statistic level，重新建库部署服务器  ---- 检视意见提的补测

          7、观察点：数值正确性，与对应的视图或者系统表中的数据进行比对  ----在俊喆的自提单上，解决后再观察；

- 性能测试


           比对 master 与 sr 分支，开启/关闭 autotrace 对 tpch 的影响程度；无量化指标，主观判断

-  自动化


            不补充自动化，手工测试；

2）梳理该特性是否涉各个专项测试，并在详细设计中描述具体测试点

|专项|是否涉及|
|:---|:---|
|并发|不涉及|
|长稳|不涉及|
|一致性|不涉及|
|三方测试工具    
  (sqltest，sqlancer)|不涉及|
|安全|不涉及|
|DFR/testkill|不涉及|
|HA|不涉及|
|压力|不涉及|
|性能|不涉及|
|可维护性|不涉及|


  


# 5.   **测试用例**

测试设计细化后的文本用例

详见附件

# 6.   **测试框架设计**

1. 如果用例不能实现自动化需要在此标注并说明原因
1. 如果需要使用新的测试框架实现用例的自动化，需要在此说明测试框架的架构逻辑及详细设计
1. 如果沿用已有测试框架，需要在此标注测试框架的路径


# 7.   **测试环境说明**

HA 环境