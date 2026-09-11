Created by 鄢红亮 on 十一月 14, 2023

#   [YDBRD-7675](https://jira.yasdb.com/browse/YDBRD-7675?src=confmacro)    **-**  **【列存支持】Crab 去掉开源的binary-heap-plus/compare依赖**  **完成**

# **1. 概述**

- 整改开源库，去掉crab中的Binary-heap和compare依赖


# **2. 需求分析**

## 1. 功能描述

- 实现Binary-heap，替换掉crab中使用的Binary-heap库和compare库
- Binary-heap为二叉堆，可作为最大堆使用，也可以作为最小堆使用


# **3. 测试设计方法**

**主要采用的等价类划分，边界值**  **，场景法组合及错误推测法进行设计**

|【列存支持】Crab 去掉开源的binary-heap-plus/compare依赖|前置条件|修改columnar_vm_buffer_size（改小）|  
|  
|  
|
|---|---|---|---|---|---|
|||大数据量|5G、10G、15G、20G|  
|  
|
||用例|执行order by相关的用例以及带order by组合的sql语句|PLSQL|  
|  
|
||||from|JOIN|inner join|
||||||left join|
||||||right join|
||||||full join|
|||||子查询|关联子查询|
||||||非关联子查询|
||||||子查询嵌套|
||||||在子查询中的位置|
||||WHERE|比较符号（=, >, >=, <, <=, <>）|  
|
|||||between and , in , exists, any, all |  
|
|||||and, or|  
|
|||||GROUP BY|  
|
|||||HAVING|  
|
|||||LIMIT|  
|
|||||集合运算|union|
||||||union all|
||||||intersect|
||||||minus|
|||||比较两个同音不同字的词|  
|
|||利用tpch的sql来验证|  
|  
|  
|


  


  


# **4. 详细测试设计**

[【列存支持】Crab 去掉开源的binary-heap-pluscompare依赖.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YTg4OTcwYzJhZjRmNTFmOWJjIiwicmVmX2lkIjoiNjczOTY5YTg1OTNmOTljOWZmMjM1MTE1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4MTU0LCJleHAiOjE3ODIyOTQ1NTR9.DPmojQgFYiy85Cz5pHtv7uhor3DkOQDiT2tdVx2bJzc)

  


# **5. 测试框架设计**

1. **本次测试采用Guider测试框架实现，执行sql文件，对比期望结果与输出结果，输出测试结果。**


# **6. 测试环境说明**

|**服务器**|** **|
|:---|:---|
|操作系统|Linux|
|部署|单机,分布式|


## Attachments:

[【列存支持】Crab 去掉开源的binary-heap-pluscompare依赖.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YTg4OTcwYzJhZjRmNTFmOWJjIiwicmVmX2lkIjoiNjczOTY5YTg1OTNmOTljOWZmMjM1MTE1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4MTU0LCJleHAiOjE3ODIyOTQ1NTR9.DPmojQgFYiy85Cz5pHtv7uhor3DkOQDiT2tdVx2bJzc)

 (application/x-xmind)    
