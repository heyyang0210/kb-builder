Created by 李凯峰, last modified on 十一月 13, 2023

# 1.   **概述**

sr:    [YDBRD-8125](https://jira.yasdb.com/browse/YDBRD-8125?src=confmacro)    -  【列存支持】支持跨DXG的runtime filter下推  完成

设计文档：    [YDBRD-8125 : Dstb Runtime Filter Design（分布式Runtime Filter方案设计） - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=107381981)  

# 2.   **需求分析**

**实现了分布式列存支持下推功能，即将 hash table 的 bloomfilter 下推到 probe 表的 tablescan，使 probe 能提前过滤一部分数据，减少 probe 在 hash table 上的探测次数，优化查询性能；**

- 支持多列与表达式的Hash Join进行下推；
- 数据类型要求一致（隐式转换可以下推）
- Left/Full/AntiSemi不支持下推；


# 3.   **测试设计方法**

主要采用的等价类划分，边界值  ，场景法组合及错误推测法进行设计

4.   **详细测试设计**

  


1）

[分布式RunTime Filter下推.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMDRhMWFkOWEzMzExZGM3YTEwIiwicmVmX2lkIjoiNjczOTZhMDQ1OTNmOTljOWZmMjM1NGQ0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwNzA0LCJleHAiOjE3ODIyOTcxMDR9.xxVAtgt5RQqBYkEuwi3VKkk6Kps5XeG45vl4nPh04LI)

2）梳理该特性是否涉各个专项测试，并在详细设计中描述具体测试点

|专项|是否涉及|
|---|---|
|并发|涉及|
|长稳|涉及|
|一致性|不涉及|
|三方测试工具    
  (sqltest，sqlancer)|不涉及|
|安全|不涉及|
|DFR/testkill|涉及|
|HA|不涉及|
|压力|不涉及|
|性能|涉及|
|可维护性|涉及|


  


  


# 5.   **测试用例**

  


|输入条件|有效等价类|备注|无效等价类|备注|
|---|---|---|---|---|
|BLOOM_FILTER_FACTOR阈值|>=child选择率|通过设置BLOOM_FILTER_FACTOR = 1 来覆盖测试场景|<child选择率|不会用条件下推|
|存储类型|tac/lsc|  
|  
|  
|
|表类型|分布表、复制表、分区表|  
|  
|  
|
|join表的数量|2 and >2|  
|  
|  
|
|join key字段个数|2 and >2 and 单个|  
|  
|  
|
|join key数据类型|字符型、数值型、时间类型、raw|  
|  
|  
|
|join filter（on 后面接的条件）|同一filter两边的join key数据类型相同,同一filter两边的join key可隐式转换,各filter之间的join key类型相同,各filter之间的join key类型不同,filter之间通过and组合,部分条件值包含内置函数，如：    [t1.id](http://t1.id)    =abs(    [t2.id](http://t2.id)    ),部分条件值包含表达式，如：    [ti.id](http://ti.id)    =    [t2.id](http://t2.id)    +1|  
|filter之间通过or组合,条件值为子查询,条件值为join查询,条件值为集合操作union/union all/intersect/intersect all/minus/minus all|  
|
|where filter|谓词：>、<、>=、<=、<>、!=、between and、in/not in、like/not like、exists/not exists,组合：and、or,filter数据类型：数值型、字符类型、时间类型,group by(having)、order by、distinct,条件值为子查询、条件值为join查询、条件值为集合操作union/union all/intersect/intersect all/minus/minus all、部分条件值包含内置函数，如    [ti.id](http://ti.id)    =abs(    [t2.id](http://t2.id)    )、部分条件值包含表达式，如：    [ti.id](http://ti.id)    =    [t2.id](http://t2.id)    +1|  
|  
|  
|
|约束|主键、唯一约束、普通索引、分区索引、ac|  
|  
|  
|
|与其他算子结合|与NL join组合：hash join左节点是NL join、hash join右节点是NL join（上面是probe，下面是build）,与Merge join组合,与hash join组合,与view组合：子查询、CTE、集合操作|  
|  
|  
|
|分发与合并|详见xmind|  
|  
|  
|
|并发、KILL|  
|  
|  
|  
|
|长稳|  
|  
|  
|  
|
|TPCH性能（提升较大：q17、q9）|  
|  
|  
|  
|
|并行|  
|  
|  
|  
|
|调整join使用的内存的参数：  COLUMNAR_VM_BUFFER_SIZE|  
|  
|  
|  
|
|128join|  
|  
|  
|  
|


# 6.   **测试框架设计**

1. 使用GUIDER框架即可


# 7.   **测试环境说明**

|服务器类型|os|  
|
|:---|:---|:---|
|vm|centos|单机/集群|


  


[XXX功能测试设计.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMDQ4OTcwYzJhZjRmNTFmYjk5IiwicmVmX2lkIjoiNjczOTZhMDQ1OTNmOTljOWZmMjM1NGQ0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwNzA0LCJleHAiOjE3ODIyOTcxMDR9.WUYqca1Tykux4vkbZvYslmL697-SxZsXLdrJzFLCstI)

## Attachments:

[配置参数打印到run.log日志.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMDQ4OTcwYzJhZjRmNTFmYjlhIiwicmVmX2lkIjoiNjczOTZhMDQ1OTNmOTljOWZmMjM1NGQ0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwNzA0LCJleHAiOjE3ODIyOTcxMDR9.nMT5VS_NQGZVFyJ2iYkULYyEc9oAW9nmJsbOUeLL97k)

 (application/x-xmind)    


[check.svg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMDRhMWFkOWEzMzExZGM3YTExIiwicmVmX2lkIjoiNjczOTZhMDQ1OTNmOTljOWZmMjM1NGQ0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwNzA0LCJleHAiOjE3ODIyOTcxMDR9.k7NidlyqHsJd8f8pnpZFhDfbYs5-KUl1eXJAQ-dazJ8)

 (image/svg+xml)    


[XXX功能测试设计.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMDQ4OTcwYzJhZjRmNTFmYjk5IiwicmVmX2lkIjoiNjczOTZhMDQ1OTNmOTljOWZmMjM1NGQ0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwNzA0LCJleHAiOjE3ODIyOTcxMDR9.WUYqca1Tykux4vkbZvYslmL697-SxZsXLdrJzFLCstI)

 (application/msword)    


[YDBRD-21634行存支持length2函数.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMDRhMWFkOWEzMzExZGM3YTEyIiwicmVmX2lkIjoiNjczOTZhMDQ1OTNmOTljOWZmMjM1NGQ0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwNzA0LCJleHAiOjE3ODIyOTcxMDR9.SsdzdAv3Lb2ZiyyU3hdh9WQSUQI_YJLuCtdKhm0rabY)

 (application/x-xmind)    


[分布式RunTime Filter下推.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMDRhMWFkOWEzMzExZGM3YTEwIiwicmVmX2lkIjoiNjczOTZhMDQ1OTNmOTljOWZmMjM1NGQ0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwNzA0LCJleHAiOjE3ODIyOTcxMDR9.xxVAtgt5RQqBYkEuwi3VKkk6Kps5XeG45vl4nPh04LI)

 (application/x-xmind)    
