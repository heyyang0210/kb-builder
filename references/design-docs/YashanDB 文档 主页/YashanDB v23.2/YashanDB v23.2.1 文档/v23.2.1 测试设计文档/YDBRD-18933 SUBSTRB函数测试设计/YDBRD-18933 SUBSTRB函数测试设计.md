Created by 周彬鑫, last modified on 十月 16, 2024

# 1. 概述

支持substrb函数

# 2. 需求分析

## 2.1 功能点分析

- 语法图


![](https://conf.yasdb.com/download/attachments/119560761/WXWorkLocal_16899301748637.png?version=1&modificationDate=1689930120000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTU2OTUsImV4cCI6MTc4MjMwNjQ5NX0.9892tF-clCe8lrVuDTQ9WrAu4fqySTrKhYmNP-Q0xjk)

## 2.2 应用场景

substrb函数()主要功能为，按照字节长度，对指定字符串str，从position开始进行截取，截取length个字节，最终返回，如果截取在汉字中间，则视为错误字节，按错误字节个数补对应空格。

## 2.3 规格约束

**参数1**  .str 原字符串，需要是字符型或者可以隐式转换为字符型的表达式  ，不支持NCLOB。

汉字： 若读取的3个字节不是完整的汉字，非完整汉字部分用空格进行显示。例如：select substrb('中abc', 2, 3) from dual; 返回：’  a‘ (a前有两个空格)。 

**参数2**  .position 提取子串的起始位置（以1为基），可为数值类型或可转换为数值类型的字符类型。转换后的数值类型范围为-2147483648~2147483647，否则value is larger than INTEGER allowed

- 浮点类型（float和double）舍入和截断规则不同，number类型截断，浮点类型奇进偶舍。
- 超过str长度，返回null；
- 若pos为负数时，为倒序的起始位置；
- 若pos为0时，按照第1个字节为起始位置。


**参数3**  .length 提取子串的长度，可为数值类型或可转换为数值类型的字符类型。转换后的数值类型范围为-2147483648~2147483647，否则value is larger than INTEGER allowed

- 浮点类型（float和double）舍入和截断规则不同，number类型截断，浮点类型奇进偶舍。
- 超过integer的最大值，报错。
- 若length<=0，返回null；
- 若length值大于从position值指定位置到str结尾的长度，或缺省length参数时，函数返回从position指定位置至str结尾的所有字节；


# 3. 详细测试设计

## 3.1 测试设计方法

主要采用的等价类划分，边界值  ，场景法组合及错误推测法进行设计

对于函数名称关键字校验、函数结合DML、DDL等语法的场景，使用场景法组合。

对于参数个数，函数嵌套层数场景，使用边界值分析方法设计。

对于参数数据类型，使用等价类划分法设计。

|输入条件|有效等价类|编号|无效等价类|编号|
|:---|:---|:---|:---|:---|
|函数名称关键字校验|与表、视图同名|  
|拼写错误、名称缺失、带单/双引号|  
|
|  
|函数名称大小写|  
|  
|  
|
|参数个数|2个|  
|0个、4个、1个|  
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
|考虑position、length的边界值问题：position大于str实际长度，length大于从position开始剩余长度|  
|  
|  
|
|  
|position、length有小数时的表现（NUMBER、浮点型）|  
|  
|  
|
|  
|position、length为0或负数的表现|  
|  
|  
|
|  
|中文字符，中间截断|  
|  
|  
|
|函数返回值|str为raw类型返回raw类型，其余返回值为varchar类型|  
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
|v$function 中新增函数名|有SUBSTRB函数|  
|  
|  
|
|tac/lsc不支持|拦截该函数|  
|  
|  
|


## 3.2 详细测试设计

1. *使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式*
1. *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*


[SUBSTRB函数测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOThhMWFkOWEzMzExZGM4NDE5IiwicmVmX2lkIjoiNjczOTZiOTg1OTNmOTljOWZmMjM2NGFlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1Njk0LCJleHAiOjE3ODIzODIwOTR9.cOJBJCx75f5qhctNx_3Lv9CN7zyhzLvT0iN7VxTQDtw)

|系统级DFX分类|是否涉及|
|---|---|
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


[SUBTRB冒烟用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOTg4OTcwYzJhZjRmNTIwNWE0IiwicmVmX2lkIjoiNjczOTZiOTg1OTNmOTljOWZmMjM2NGFlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1Njk0LCJleHAiOjE3ODIzODIwOTR9.mjgCf5gwCTUY2cneFQ_0tkj8_-b1DiW4uZuFoR9qZFs)

[SUBSTRB文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOTg4OTcwYzJhZjRmNTIwNWE1IiwicmVmX2lkIjoiNjczOTZiOTg1OTNmOTljOWZmMjM2NGFlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1Njk0LCJleHAiOjE3ODIzODIwOTR9.XYsh8APtZnrJoBKlciudSxEwx7U1oTYFOhzBk0mxSrg)

详见附件

# 5. 测试框架设计

1. 使用guider框架，执行sql文件 对比预期与实际输出结果


# 6. 测试环境说明

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|单机、集群|


# 7. 工作量评估

工作量：5  *人天*

计划测试完成时间：2023/10/19

## Attachments:

[SUBSTRB函数测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOThhMWFkOWEzMzExZGM4NDE5IiwicmVmX2lkIjoiNjczOTZiOTg1OTNmOTljOWZmMjM2NGFlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1Njk0LCJleHAiOjE3ODIzODIwOTR9.cOJBJCx75f5qhctNx_3Lv9CN7zyhzLvT0iN7VxTQDtw)

 (application/x-xmind)    


[SUBSTRB文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOTg4OTcwYzJhZjRmNTIwNWE1IiwicmVmX2lkIjoiNjczOTZiOTg1OTNmOTljOWZmMjM2NGFlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1Njk0LCJleHAiOjE3ODIzODIwOTR9.XYsh8APtZnrJoBKlciudSxEwx7U1oTYFOhzBk0mxSrg)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[SUBTRB冒烟用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOTg4OTcwYzJhZjRmNTIwNWE0IiwicmVmX2lkIjoiNjczOTZiOTg1OTNmOTljOWZmMjM2NGFlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1Njk0LCJleHAiOjE3ODIzODIwOTR9.mjgCf5gwCTUY2cneFQ_0tkj8_-b1DiW4uZuFoR9qZFs)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
