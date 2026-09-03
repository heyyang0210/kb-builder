## **1.需求概述：**

分布表当前只支持index coalesce可以只coalesce一个分区

## **1.1需求范围：**

**分布式**

**SR链接：**  [https://pingcode.yasdb.com/pjm/items/67049e4be489dd0868f18457?](https://pingcode.yasdb.com/pjm/items/67049e4be489dd0868f18457?)  

#YDBRD-33408 分布式支持index coalesece



# 2.   **需求分析**

针对分布式下分布表 1/2级分区 Index coalesce



# **3. 测试设计方法**

**(1). 使用场景法设计**

**(2). DFX覆盖并发+长稳场景**



### 3.1 DFX覆盖：

|系统级DFX分类|是否涉及|备注|
|:---|:---|:---|
|CT|Y|  
|
|KT|Y|  
|
|长稳|Y|  
|
|一致性|N|  
|
|三方测试工具    
  (sqltest，sqlancer)|N|  
|
|安全|N|  
|
|DFR|N|  
|
|HA|N|  
|
|压力|N|  
|
|性能|N|  
|
|可维护性|N|  
|
|升级|N|  
|
|资料|Y||


# **4. 详细测试设计**

|测试场景|预期|备注||
|---|---|---|---|
|一级分区分布表+普通索引/唯一索引/函数索引/反向索引  修改Coalesce前后做统计信息收集，查询DBA_INDEXS"|dba_indexes前后比较LEAF_BLOCKS 修改前小于修改后BLCOKS||  
|
|二级分区HASH-HASH分布表+唯一索引/函数降序索引  修改Coalesce前后做统计信息收集，查询DBA_INDEXS"  
|||  
|
|二级分区HASH-LIST分布表+唯一索引/函数降序索引  修改Coalesce前后做统计信息收集，查询DBA_INDEXS"  
|||  
|
|二级分区HASH-RANGE分布表+唯一索引/函数降序索引  修改Coalesce前后做统计信息收集，查询DBA_INDEXS"||||
|一级分区分布表+唯一索引  修改Coalesce前后做统计信息收集，查询DBA_INDEXS"||||
|二级分区HASH-HASH分布表+唯一索引  修改Coalesce前后做统计信息收集，查询DBA_INDEXS"||||
|二级分区HASH-LIST分布表+唯一索引  修改Coalesce前后做统计信息收集，查询DBA_INDEXS"||||
|二级分区HASH-RANGE分布表+唯一索引  修改Coalesce前后做统计信息收集，查询DBA_INDEXS"||||
|长稳场景：遍历基表分区索引，修改INDEX coalesce||||
|CT/KT场景：,前置：hash 分区表带唯一索引 ,并发：统计信息收集+查询,Update/delete/insert  ,遍历基表分区索引，修改INDEX coalesce|无Core|||


# **5.测试框架设计**

**功能用例添加到YTP平台上**

**DFX用例分别添加到yasft_dfx以及yasft仓上**

# **6.测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|LIUNX|
|部署|单机、分布式、集群|


# 

