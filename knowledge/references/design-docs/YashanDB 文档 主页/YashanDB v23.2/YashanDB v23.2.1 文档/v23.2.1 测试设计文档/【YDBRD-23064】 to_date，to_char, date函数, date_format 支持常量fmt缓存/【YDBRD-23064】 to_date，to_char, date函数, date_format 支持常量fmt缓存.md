Created by 李凯峰, last modified on 一月 18, 2024

# 1. 概述

*1.sr：*    [YDBRD-23064](https://jira.yasdb.com/browse/YDBRD-23064?src=confmacro)    *-*  *CLONE - to_date，to_char, date函数, date_format 支持常量fmt缓存*  *完成*

*2.设计文档：*    [详细设计-YDBRD-23064: to_char/to_date等函数支持常量fmt缓存 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=135626307)  

*3.22.2性能测试报告：*    [22.2 常量FMT缓存性能测试报告 - 李凯峰 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=138552526)  

# 2. 需求分析

## 2.1 功能点分析

（1）函数在参数为时间类型的常量fmt时，将参数进行匹配并记录下对应id，在执行时减少fmt查找流程

（2）在加载dateFormat配置参数或者设置dateFormat配置参数时，记录fmt对应id；这样在数据插入，filter比较时能较少text转date的fmt查找流程

- to_date、to_timestamp、trunc、date、to_char函数设置fmt，常量缓存FMT
- column(date)  ：插入字符串，常量缓存FMT
- filter  ：date与字符串比较，常量缓存FMT  
- 重点关注性能


## 2.2 应用场景

- 函数
- filter
- insert
- 投影列


## 2.3 规格约束

- 22.2行存计算
- 绑定参数不能缓存


# 3. 详细测试设计

## 3.1 测试设计方法

场景法、等价类、边界值

## 3.2 详细测试设计

|  
|测试点|细分|预期|备注|
|---|---|---|---|---|
|场景法+等价类+边界值：,功能测试点|跑22.2二层上车CI即可|-|与CI原预期一致|无需新增功能用例|
|场景法：性能|函数|to_date、to_timestamp、trunc、date、to_char|  
|  
|
|  
|  
|设置date_fmt,1.date_fmt与系统date_fmt参数设置不一致,2.与系统date_fmt参数设置一致,3.不同的连接符，如：    `:`    、    `-`    、       `/`    、       `.`    、       `,`    、       `;`    、       `\`    、       `_`    、,4.中文连接符：不支持,5.出现在投影列中,6.出现在filter中,7.出现在insert中,8.出现在update中,9.出现在insert into select中,10出现在集合中,11.出现在子查询中|  
|建表：TPCH中orders表，17G数据量，150000000条数据,用有特性的包与无特性的包对比|
|  
|insert|批插|  
|  
|
|场景法：filter测试点|date+varchar对比|  
|  
|  
|
|  
|date+date对比|  
|  
|  
|
|  
|date+常量对比|  
|  
|  
|
|  
|date+字段+fmt常量对比|  
|  
|  
|
|  
|date+FMT变量对比|  
|  
|  
|
|  
|varchar+date+字段+FMT常量对比|  
|  
|  
|
|  
|varchar+字段+FMT常量对比|  
|  
|  
|
|场景法：,并发|用testkill框架执行相关用例|  
|  
|  
|


*梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*

|系统级DFX分类|是否涉及|
|---|---|
|CT|是|
|KT|是|
|长稳|否|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|否|
|安全|否|
|DFR|否|
|HA|否|
|压力|否|
|性能|是|
|可维护性|是|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件

# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：

[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYzVhMWFkOWEzMzExZGM4NTQ3IiwicmVmX2lkIjoiNjczOTZiYzU3MjgyMDZlZmI5MmYwYTEwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2OTE0LCJleHAiOjE3ODIzODMzMTR9.9qMte0F0IS70UpDdFeacmnDoI2xrLku0Zsy_BGcIxtc)

## Attachments:

[image2022-1-13_19-47-6.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYzVhMWFkOWEzMzExZGM4NTQ4IiwicmVmX2lkIjoiNjczOTZiYzU3MjgyMDZlZmI5MmYwYTEwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2OTE0LCJleHAiOjE3ODIzODMzMTR9.5akVzQH9Cq1dAnonWQNrMQHYHggXzEf3o8yI7gYZCuk)

 (image/png)    


[image2022-1-13_18-3-40.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYzVhMWFkOWEzMzExZGM4NTQ5IiwicmVmX2lkIjoiNjczOTZiYzU3MjgyMDZlZmI5MmYwYTEwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2OTE0LCJleHAiOjE3ODIzODMzMTR9.vIsyoKblkRPmlz4DOYKNSbaz1sN8ChssnkwLKQG6jQA)

 (image/png)    


[image2022-1-13_19-46-25.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYzVhMWFkOWEzMzExZGM4NTRhIiwicmVmX2lkIjoiNjczOTZiYzU3MjgyMDZlZmI5MmYwYTEwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2OTE0LCJleHAiOjE3ODIzODMzMTR9.1Ps1FGcP89dLkOgt6nAYSxXh3vzXSgCgrQ4WnCSCdp4)

 (image/png)    


[image2023-11-6_16-34-55.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYzVhMWFkOWEzMzExZGM4NTRiIiwicmVmX2lkIjoiNjczOTZiYzU3MjgyMDZlZmI5MmYwYTEwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2OTE0LCJleHAiOjE3ODIzODMzMTR9.P583BXQHN6WLzAMT2Jm0gW4po4EYYvtrPUz8pem2rG8)

 (image/png)    


[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYzVhMWFkOWEzMzExZGM4NTQ3IiwicmVmX2lkIjoiNjczOTZiYzU3MjgyMDZlZmI5MmYwYTEwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2OTE0LCJleHAiOjE3ODIzODMzMTR9.9qMte0F0IS70UpDdFeacmnDoI2xrLku0Zsy_BGcIxtc)

 (application/msword)    


[XXX功能测试设计.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYzU4OTcwYzJhZjRmNTIwNmQ0IiwicmVmX2lkIjoiNjczOTZiYzU3MjgyMDZlZmI5MmYwYTEwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2OTE0LCJleHAiOjE3ODIzODMzMTR9.Sr-1qvY-18PtmYlaxbsF6h9dwYMzyrOa99TXsSNc7SA)

 (application/msword)    
