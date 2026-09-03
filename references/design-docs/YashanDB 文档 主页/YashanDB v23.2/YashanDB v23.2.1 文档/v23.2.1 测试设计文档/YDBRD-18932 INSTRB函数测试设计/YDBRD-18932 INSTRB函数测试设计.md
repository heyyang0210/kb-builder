Created by 周彬鑫, last modified on 十月 16, 2024

# 1. 概述

INSTRB函数测试设计

# 2. 需求分析

## 2.1 功能点分析

- 语法图如下


![](https://docs.oracle.com/cd/B19306_01/server.102/b14200/img/instr.gif?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTU2ODQsImV4cCI6MTc4MjMwNjQ4NH0.mGeVbo-vARwDnaMuCK0kfia2cgkO3l0fsFG6PvClajw)

## 2.2 应用场景

INSTRB函数，在string中的position位置开始查找substring，并返回第occurrence次出现的位置（按字节位置）。

## 2.3 规格约束

- string起始位置记为第1位，返回值为匹配到的substring的第1位字节的位置,  **未命中返回0**
- string和substring不可为空
- position和occurrence可为空，两个参数的默认值为1。
- position必须是非0参数，如果是负数，就从后向前匹配。
- occurrence必须大于零。
- 小数情况直接取整


# 3. 详细测试设计

## 3.1 测试设计方法

主要采用的等价类划分，边界值  ，场景法组合及错误推测法进行设计。

对于函数名称关键字校验、函数结合DML、DDL等语法的场景，使用场景法组合。

对于参数个数，函数嵌套层数场景，使用边界值分析方法设计。

对于参数数据类型，使用等价类划分法设计。

|输入条件|有效等价类|编号|无效等价类|编号|
|---|---|---|---|---|
|函数名称关键字校验|与表、视图同名|  
|拼写错误、名称缺失、带单/双引号|  
|
|  
|函数名称大小写|  
|  
|  
|
|参数个数|2个|  
|0个、5个、1个|  
|
|参数数据类型|覆盖所有普通数据类型|  
|position、occurrence 数值大小超uint32|  
|
|  
|参数为常量、伪列、子查询|  
|参数position、occurrence为不能转换为number的数据类型|  
|
|  
|参数为表达式、四则运算|  
|  
|  
|
|函数功能|函数自嵌套127层|  
|函数自嵌套128层|  
|
|  
|与其他函数嵌套|  
|  
|  
|
|  
|考虑position、occurrence的边界值问题：position大于str实际长度，occurrence大于substring实际出现次数|  
|  
|  
|
|  
|position、occurrence有小数时的表现（NUMBER、浮点型）|  
|  
|  
|
|  
|position、occurrence为0或负数的表现|  
|  
|  
|
|函数返回值|返回值类型 64int|  
|  
|  
|
|DML|update作为set值以及where条件|  
|  
|  
|
|  
|insert作为value值|  
|  
|  
|
|  
|insert select|  
|  
|  
|
|  
|delete 作为where条件|  
|  
|  
|
|DDL|create view as select|  
|  
|  
|
|  
|create materialized as select|  
|  
|  
|
|  
|create table as select|  
|  
|  
|
|filter|比较，in、not in、exists、not exists、between and 、like/not like、group by、having、join on、order by、connect by、limit、offset|  
|  
|  
|
|  
|在子查询的filter、投影|  
|  
|  
|
|集合|集合、多表查询、join on|  
|  
|  
|
|PLSQL|case、if、for、绑定参数|  
|  
|  
|
|系统表/视图|简单覆盖 v$function|  
|  
|  
|
|临时表|简单覆盖|  
|  
|  
|
|并行|简单覆盖，关注执行计划|  
|  
|  
|
|v$function 中新增函数名|有INSTRB函数|  
|  
|  
|
|tac/lsc不支持|拦截该函数|  
|  
|  
|


## 3.2 详细测试设计

1）使用章节3的测试方法设计详细的测试点，可沿用xmind的方式

[INSTRB函数测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOTc4OTcwYzJhZjRmNTIwNTllIiwicmVmX2lkIjoiNjczOTZiOTc3MjgyMDZlZmI5MmYwN2YyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1Njg0LCJleHAiOjE3ODIzODIwODR9.5HvSD87lvISFWuNzox0vHUh0m-bA0P0Qv35LMakCP2c)

2）梳理该特性是否涉各个专项测试，并在详细设计中描述具体测试点

|系统级DFX分类|是否涉及|
|:---|:---|
|CT|是|
|KT|是|
|长稳|  
|
|一致性|  
|
|三方测试工具    
  (sqltest，sqlancer)|  
|
|安全|  
|
|DFR|  
|
|HA|  
|
|压力|  
|
|性能|  
|
|可维护性|  
|


  


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


[INSTRB冒烟用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOThhMWFkOWEzMzExZGM4NDE2IiwicmVmX2lkIjoiNjczOTZiOTc3MjgyMDZlZmI5MmYwN2YyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1Njg0LCJleHAiOjE3ODIzODIwODR9.nERYrvIfvhXPvJjuQMFi5zcNryXTSPhNEoWIZW83k_Q)

[INSTRB文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOTg4OTcwYzJhZjRmNTIwNTlmIiwicmVmX2lkIjoiNjczOTZiOTc3MjgyMDZlZmI5MmYwN2YyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1Njg0LCJleHAiOjE3ODIzODIwODR9.ZzjI9OVu8B18Bb3NS-PONGJ6mW_MiT8yu3-DEabJkKg)

# 5. 测试框架设计

使用guider框架，执行sql文件 对比预期与实际输出结果

# 6. 测试环境说明

|服务器|  
|
|---|---|
|操作系统|Linux|
|部署|单机、集群|


# 7. 工作量评估

工作量：5  *人天*

计划测试完成时间：2023/10/19

## Attachments:

[INSTRB函数测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOTc4OTcwYzJhZjRmNTIwNTllIiwicmVmX2lkIjoiNjczOTZiOTc3MjgyMDZlZmI5MmYwN2YyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1Njg0LCJleHAiOjE3ODIzODIwODR9.5HvSD87lvISFWuNzox0vHUh0m-bA0P0Qv35LMakCP2c)

 (application/x-xmind)    


[INSTRB文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOTg4OTcwYzJhZjRmNTIwNTlmIiwicmVmX2lkIjoiNjczOTZiOTc3MjgyMDZlZmI5MmYwN2YyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1Njg0LCJleHAiOjE3ODIzODIwODR9.ZzjI9OVu8B18Bb3NS-PONGJ6mW_MiT8yu3-DEabJkKg)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[INSTRB冒烟用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOThhMWFkOWEzMzExZGM4NDE2IiwicmVmX2lkIjoiNjczOTZiOTc3MjgyMDZlZmI5MmYwN2YyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1Njg0LCJleHAiOjE3ODIzODIwODR9.nERYrvIfvhXPvJjuQMFi5zcNryXTSPhNEoWIZW83k_Q)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
