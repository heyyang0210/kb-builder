Created by 张江, last modified on 十月 15, 2024

# 1.概述

本文档用于描述在PLSQL中支持定义和处理varchar/char(32000 char)类型变量测试设计。

SR链接：    [YDBRD-14135](https://jira.yasdb.com/browse/YDBRD-14135?src=confmacro)    -  PLSQL支持定义和处理varchar(32000 char)  完成    [YDBRD-14178](https://jira.yasdb.com/browse/YDBRD-14178?src=confmacro)    -  PLSQL支持定义和处理varchar(32000 char)  完成

# 2.需求分析

1、使用场景：覆盖多个使用场景，如匿名块、存储过程、自定义函数、自定义package、自定义类型、定时任务和触发器中参数、变量定义和处理逻辑；

2、语法兼容：plsql定义和使用varchar/char(n char)类型变量，  n的范围是1-32000；

3、规格约束：

      定义varchar(n char)类型时，最大支持长度为32000 bytes;

      定义char(n char)类型时，如果放入字符m(m<n)个，添加n-m个空格，优先按照字符数添加；如果按照字符数补齐会超过32000字节，则只会补齐到32000字节

# 3.测试设计方法

本次测试设计主要使用边界值、场景分析法以及相关的组合策略来设计。

# 4.详细测试设计

1）使用章节3的测试方法设计详细的测试点，可沿用xmind的方式

详细测试设计见：

2）梳理该特性是否涉各个专项测试，并在详细设计中描述具体测试点

|专项|是否涉及|
|:---|:---|
|并发|  
|
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


# 5.测试用例

待补充。

# 6.测试框架设计

1. 如果用例不能实现自动化需要在此标注并说明原因
1. 如果需要使用新的测试框架实现用例的自动化，需要在此说明测试框架的架构逻辑及详细设计
1. 如果沿用已有测试框架，需要在此标注测试框架的路径


# 7.测试环境说明

测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等

  


  


  


## Attachments:

[PLSQL支持定义和处理varchar(32000 char)测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5OTQ4OTcwYzJhZjRmNTFmOTJlIiwicmVmX2lkIjoiNjczOTY5OTQ3MjgyMDZlZmI5MmVmNGE2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3NDAzLCJleHAiOjE3ODIyOTM4MDN9.uKZSkBjwUXQV573Mltf75Hwj5RGGsPFjVow0chjlG8c)

 (application/x-xmind)    


[PLSQL支持定义和处理varchar(32000 char)测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5OTQ4OTcwYzJhZjRmNTFmOTJmIiwicmVmX2lkIjoiNjczOTY5OTQ3MjgyMDZlZmI5MmVmNGE2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3NDAzLCJleHAiOjE3ODIyOTM4MDN9.ti94gYkKghIBQIsXTS6BDIbVLlTK1vy13T86uoiyQ4g)

 (application/x-xmind)    


[PLSQL支持定义和处理varchar(32000 char)测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5OTRhMWFkOWEzMzExZGM3N2E0IiwicmVmX2lkIjoiNjczOTY5OTQ3MjgyMDZlZmI5MmVmNGE2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3NDAzLCJleHAiOjE3ODIyOTM4MDN9.d_tojf4VqC5DqO8V1n_VG1Ail7kDkDn6Lm6STuJ-ato)

 (application/x-xmind)    
