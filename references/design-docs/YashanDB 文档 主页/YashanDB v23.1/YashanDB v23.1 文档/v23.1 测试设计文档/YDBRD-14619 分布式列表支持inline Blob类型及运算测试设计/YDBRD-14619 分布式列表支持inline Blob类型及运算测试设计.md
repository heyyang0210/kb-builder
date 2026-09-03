Created by 党文琪, last modified on 十月 12, 2024

# 1.   **概述**

本文档描述声明为批量SQL测试设计。

SR链接：    [YDBRD-14619](https://jira.yasdb.com/browse/YDBRD-14619?src=confmacro)    -  分布式列表支持inline Blob类型及运算  完成

# 2.   **需求分析**

**对功能/需求进行详细说明及分析，包括但不限于需求涉及的规格、约束，主要业务场景，系统/模块上下文等**

本需求重点关注inline Blob（长度小于等于  32000  ）类型，在单机列存，分布式上，与列存函数的运算结果

# 3.   **测试设计方法**

**1、覆盖inline类型的边界值**

**2、遍历覆盖列存函数**

# 4.   **详细测试设计**

**1）测试场景**

**本次测试需要覆盖单机列存及分布式**

**2）列存函数**

覆盖列存函数，关注cast，nvl/nvl2，wm_concat，函数关注列表：

  [blob列存函数 - 党文琪 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=113969499)  

关注类型转换，边界值及结果对比

**3）根据设计补充拦截用例**

- 不能作为索引列
- 不能在LOB列上建立check约束项
- 不能修改LOB列的数据类型
- 不能作为分区键
- 不能对含有LOB列的列存表执行UPDATE操作
- 不能以LOB列作为过滤条件对列存表执行DELETE操作
- 开启附加日志后，不能对列存表执行任何DELETE操作


已支持

- 分布式架构中不支持CLOB作为分布键
- blob在函数需要转成字符串时做utf8合法检查


覆盖varchar，char，clob，json，在匿名块调用，raw

- blob不支持比较 -> blob不支持distinct
- blob不支持排序 -> lsc表建表第一列不可以是blob
- 并发用例：cast及nvl转换的调用
- 


# 5.   **测试用例**

**文本用例：**

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
|性能|  
|
|可维护性|  
|


# 6.   **测试环境说明**

测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等

## Attachments:

[分布式列表支持inline Blob类型及运算.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5OThhMWFkOWEzMzExZGM3N2NiIiwicmVmX2lkIjoiNjczOTY5OTg1OTNmOTljOWZmMjM1MDY1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3NjQxLCJleHAiOjE3ODIyOTQwNDF9.4vaNf5O1pyKCCz2uJqPvGDryzL4Nbs0GpOEBRyhiNVk)

 (application/x-xmind)    


[inline_blob.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5OTg4OTcwYzJhZjRmNTFmOTU1IiwicmVmX2lkIjoiNjczOTY5OTg1OTNmOTljOWZmMjM1MDY1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3NjQxLCJleHAiOjE3ODIyOTQwNDF9.WO-Rp2iZfugMr2nl89b0gp6qLyfXI3Omd8iXS4TytWc)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
