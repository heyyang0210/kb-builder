Created by 罗爽, last modified on 七月 04, 2024

# **1. 概述**

        为进一步提升分布式下的runtime filter能力，加速查询，对已有Runtime filter能力进行优化。

**SR：**    [https://pingcode.yasdb.com/pjm/items/662632c7fd997db58adefaf3](https://pingcode.yasdb.com/pjm/items/662632c7fd997db58adefaf3)    ?    
  #YDBRD-26582 Runtime Filter增强

**开发设计文档：**    [YDBRD-26582 Runtime Filter增强 方案设计](156114528.html)  

# **2. 需求分析**

1）测试场景：

      3表及以上的join，大表join小表，会  先扫描小表的数据，根据小表的数据特征，生成动态的filter条件，然后下推到大表上，进行数据过滤，减少大表的IO，提升查询性能。

2）Rumtime filter生成条件：

- join类型为hash join。
- join列为等值条件。
- 多个join列生成多个runtime filter。


3）测试关注点：

- join结果
- 执行计划
- 性能-执行时间提升


# **3. 详细测试设计**

## 3.1 测试设计方法

对本测试设计中使用的工程方法及适用的场景分类做说明，如常用的边界值，等价类，流程图及相关的组合策略。

## 3.2 详细测试设计

|测试项|有效等价类|无效等价类|补充说明|
|---|---|---|---|
|**join类型**|inner join|  
|  
|
|  
|left join|  
|  
|
|  
|right join|  
|  
|
|  
|full join|  
|  
|
|  
|cross join|  
|  
|
|**join对象**|表|  
|覆盖分布表、复制表、tac、lsc|
|  
|视图|  
|覆盖|
|  
|分区|  
|  
|
|  
|三者混合|  
|  
|
|**join key**|分布键|  
|生成local   runtime filter，不需要进行分发|
|  
|索引列|  
|走索引扫描|
|  
|ac列|  
|走ac扫描？|
|  
|非上述三类的其他列|  
|  
|
|**join key数据类型**|相同类型|  
|是否需要覆盖所有类型？,确认已有用例是否覆盖|
|  
|cast类型提升：number类型的p和scale不一样|  
|  
|
|  
|cast类型提升：待补充|  
|  
|
|**join key运算**|无|  
|eg. t1.c1 = t2.c1|
|  
|列&常量算术运算（覆盖+ - * / %）|  
|eg. t1.c1 = t2.c1 + 1|
|  
|  
|列&列算术运算|eg. t1.c1 = t2.c1 + t2.c2|
|  
|函数运算：cast、concat|  
|覆盖少量函数即可|
|**join条件个数**|单个等值条件|  
|  
|
|  
|多个等值条件|  
|生成多个runtime filter|
|  
|  
|非等值条件|不生成runtime filter|
|  
|等值条件与非等值条件混合|  
|  
|
|**join表数量**|3个|  
|  
|
|  
|4个|  
|  
|
|  
|128 [最大值]|  
|  
|
|**测试场景**|probe边为join，runtime filter下推到join的左右子树上|  
|  
|
|  
|probe边为join，  runtime filter下推join的build后，,join的build再  产生runtime filter下推到join的probe边|  
|  
|
|  
|build边为join|  
|  
|
|**并行**|DEGREE_OF_PARALLEL=1/2 * cpu|  
|作为测试前置条件，测试前打开|
|**BLOOM_FILTER_FACTOR**|=1 一定会生成runtime filter（观察执行计划）,=0.03(默认) 不一定会生成runtime filter,=0 一定不会生成runtime filter（sr无关）,=0.06（性能工程配置）|  
|  
|


## 3.3 DFX测试

|系统级DFX分类|是否涉及|测试点|
|:---|:---|:---|
|CT|否|该需求通过 sql 语法层改写实现，不涉及并发|
|KT|否|该需求通过 sql 语法层改写实现，不涉及故障|
|长稳|否|该需求为回合需求，不涉及故障情况等|
|一致性|否|测试单机场景，不涉及一致性|
|三方测试工具(sqltest，sqlancer)|否|不涉及，该需求不涉及sql语法层面的新增/修改|
|安全|否|不涉及，该需求不涉及用户密码权限等安全性相关因素，所以不涉及安全专项|
|DFR|否|该需求通过 sql 语法层改写实现，不涉及并发|
|HA|否|测试单机场景，不涉及HA用例会自动化维护|
|压力|否|此次测试不考虑压力专项，只维护基本功能|
|性能|是|1）tpcds（分析一下具体哪些sql用到rumtime filter）,2）嘉实Q4,3）每种功能测试场景，对比master与sr的性能|
|可维护性|否|无可维护性相关修改|




# **4. 测试用例**

probe边为join:

![](https://pingcode.yasdb.com/atlas/files/public/67396de38970c2af4f5215aa/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQ0FBQUFDQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBRWdBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFnRUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTI5MzcsImV4cCI6MTc4MjMyMzczN30.9pcIh638UV3X0GGIlPERwZDXWCqSTDsJzoaNCwd-t9U)

build边为join:

![](https://pingcode.yasdb.com/atlas/files/public/67396de38970c2af4f5215ab/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQ0FBQUFDQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBRWdBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFnRUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTI5MzcsImV4cCI6MTc4MjMyMzczN30.9pcIh638UV3X0GGIlPERwZDXWCqSTDsJzoaNCwd-t9U)

4表join:

![](https://pingcode.yasdb.com/atlas/files/public/67396de3a1ad9a3311dc9420/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQ0FBQUFDQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBRWdBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFnRUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTI5MzcsImV4cCI6MTc4MjMyMzczN30.9pcIh638UV3X0GGIlPERwZDXWCqSTDsJzoaNCwd-t9U)

[Runtime filter增强文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZTM4OTcwYzJhZjRmNTIxNWE4IiwicmVmX2lkIjoiNjczOTZkZTM3MjgyMDZlZmI5MmYyNDNlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEyOTM3LCJleHAiOjE3ODIzOTkzMzd9.eaoso2OIbZfkFVQIQoH_lpoexBCdYBP87Nmj_XNhUMA)

# **5. 测试框架设计**

本次测试使用guider框架，一致性框架、testkill框架和ha框架  实现。

# **6. 测试环境说明**

|- 服务器
|  
|
|:---|:---|
|操作系统|Linux|
|部署|单机,分布式,集群|


## Attachments:

[Runtime filter增强文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZTM4OTcwYzJhZjRmNTIxNWE4IiwicmVmX2lkIjoiNjczOTZkZTM3MjgyMDZlZmI5MmYyNDNlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEyOTM3LCJleHAiOjE3ODIzOTkzMzd9.eaoso2OIbZfkFVQIQoH_lpoexBCdYBP87Nmj_XNhUMA)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,2024/07/01会议纪要：    
  1.join key关注分布键、索引列、ac列、非上述三类的其他列    
  2.join key数据类型：梳理已有用例是否已覆盖，如果未覆盖需要补充。   重点关注：    
      1） SR 相关功能相同数据类型作为 join key；    
      2）SR 相关功能不同数据类型但是能隐式转换成相同数据类型作为 join key 的场景 --- 基于第8点    
  3.join key函数运算覆盖cast、concat即可    
  4.测试场景需要细化到具体用例 --- 表个数、join 条件个数、测试场景强相关，细化到具体用例来评审    
  5.测试前打开DEGREE_OF_PARALLEL=1/2 *&nbsp;cpu    
  6.性能工程对比，需要修改BLOOM_FILTER_FACTOR配置参数一致    
  7.分析tpcds具体哪些sql用到了runtime filter     
  8.梳理cast类型提升场景     
  9.每种功能测试场景，需要对比一下性能 --- 第 4 点的用例需要关注执行时间    
  10.提前跑压力测试工程master_L3_dst_perf_stress_TPCDS_test    
  提前跑bloom过滤器相关用例（如果是二层用例跑上车即可）,Posted by luoshuang at 七月 01, 2024 12:46|
|---|


