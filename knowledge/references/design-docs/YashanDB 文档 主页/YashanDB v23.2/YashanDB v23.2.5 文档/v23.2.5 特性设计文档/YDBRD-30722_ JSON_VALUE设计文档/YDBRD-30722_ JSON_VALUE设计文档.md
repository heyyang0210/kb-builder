Created by 徐伟, last modified on 八月 13, 2024

# **适用场景：IR/SR特性的详细设计文档**

*详细设计-*  *YDBRD-30722: JSON_VALUE design*  *（json_value 方案设计）*

* IR链接：*    [https://pingcode.yasdb.com/ship/ideas/669a33515808037af125a7e7](https://pingcode.yasdb.com/ship/ideas/669a33515808037af125a7e7)    *?*    
  *#YASHAN-2989 支持json_value函数*

*SR链接：*    [https://pingcode.yasdb.com/pjm/items/66a1b9e08f5ee1917345bc24](https://pingcode.yasdb.com/pjm/items/66a1b9e08f5ee1917345bc24)    *?*    
  *#YDBRD-30722 支持json_value函数*

##   [1. 总述](#1-总述)  

成熟模块的特性，概要设计和详细设计合一，必须说明本设计方案的需求来源，需求分析，功能概要描述。  **此类型设计文档要给出IR到SR拆分的依据。**

json_value返回json expr中对应的路径表达式的标量值，非标量返回null。

###   [1.1 需求来源](#11-需求来源)  

来源博时基金需求,需要满足的客户场景为：

SELECT JSON_VALUE('{"key4":-0.123,"key5":"test"}','$.key4') res FROM DUAL;

SELECT JSON_VALUE('{"key4":-0.123,"key5":"test"}','$.key5') res FROM DUAL;

###   [1.2 调研文档](#12-调研文档)  

oracle：    [https://conf.yasdb.com/pages/viewpage.action?pageId=159441493](https://conf.yasdb.com/pages/viewpage.action?pageId=159441493)  

###   [1.3 需求分析](#13-需求分析)  

我们对需求的分析，有相关联特性，可以附上关联文档。对交付特性涉及的质量属性各个方面进行概述，与第4章特性展开进行呼应。

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|---|---|---|---|---|
|功能|json_value函数|按当前外场要求，实现特定的分支，下文具体介绍|是/否|是/否|
|性能|性能场景1|该场景下关键性能指标通过什么方案满足|是/否|是/否|
|可用性|恢复场景|----|是/否|是/否|
|可靠性|故障场景|----|是/否|是/否|
|可维可测|DFX功能1|----|是/否|是/否|
|安全|安全场景1|----|是/否|是/否|
|易用性|----|----|是/否|是/否|
|可修改性|----|----|是/否|是/否|
|兼容性|----|----|是/否|是/否|
|周边配合|权限|----|----|是/否|
|周边配合|审计|----|----|是/否|
|周边配合|导入导出工具|----|----|是/否|


###   [1.4 数据字典](#14-数据字典)  

|术语|描述|借鉴业界|参考|
|---|---|---|---|
|术语1|描述|是|业界资料链接|
|术语2|描述|无|原创技术，参考技术设计链接|


###   [1.5 开源依赖](#15-开源依赖)  

无

##   [2. 接口](#2-接口)  

SR对外呈现的接口，如一个SQL语法（含多个分支），一个高级包（含多个子函数、过程），SQL语法分支、函数功能、高级包功能、系统视图与动态视图（不包含用户自定义视图）、配置参数、驱动接口、用户可感知的错误码、告警、日志 等

|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|SQL语法|语法分支1描述|----|是/否|
|SQL语法|语法分支2描述|----|是/否|
|函数|参数/返回值描述|----|是/否|
|高级包|高级包子对象描述|----|是/否|
|系统视图|视图域段描述|----|是/否|
|动态视图|视图域段描述|----|是/否|
|配置参数|配置参数作用、生效方式|----|是/否|
|驱动接口|驱动对外提供接口描述|----|是/否|
|错误码|错误码、ACTION描述|----|是/否|
|告警|告警描述|----|是/否|
|日志|日志触发条件、等级、事件描述|----|是/否|


###   [2.1 语法图](#21-语法图)  

![](https://pingcode.yasdb.com/atlas/files/public/67396ddb8970c2af4f521582/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTI0NjEsImV4cCI6MTc4MjMyMzI2MX0.BGBqqD5Nd2DpJ8jk4us2Kn2iWONiTtI0gpnGLcJ6uEo)

json_value =JSON_VALUE "(" expr [FORMAT JSON] "," JSON_basic_path_expression ")"

##   [3. 规格与约束](#3-规格与约束)  

- expr为null时返回null
- expr先转成json类型再做运算，转换规则按之前实现，未额外增加适配；如果转换失败则返回null。（与oracle差异，'12a' oracle与yashan都不能转json，但是oracle json_value返回12）
- FORMAT JSON仅语法支持
- json路径表达式只支持  **常量字符串，不支持绑定参数**  ，匹配时大小写敏感，对空格也要求匹配，具体规则同：    [Confluence —— Path Expression](https://conf.yasdb.com/display/YAS/Path+Expression+Design)  
- json_value函数参数不能静态优化，因此路径表达式不支持类似于concat('$','.key')拼接成的常量字符串
- 由于只返回标量，当路径表达式对应的value为object，array时返回为NULL; 返回为字符串时，json_value不带双引号，json_query带（与json_query差异）
- 不显示指定return clause时（当前不支持该语法），函数默认返回类型为varchar(32000),
- 标准json可以允许object的key重复，yashan按标准json实现，存在重复key时，value会使用最新的进行替换。（与oracle差异，oracle在转json时不允许重复，但是在json_value等函数会返回重复key的第一个value）


##   [4. 特性](#4-特性)  

针对功能、性能、可用性、可靠性、可维可测等各维度实现时，关键技术点（技术方案、技术难点、技术风险）的展开。

各图如何画可以用参照链接     [https://conf.yasdb.com/pages/viewpage.action?pageId=135603021](https://conf.yasdb.com/pages/viewpage.action?pageId=135603021)  

###   [4.1 特性设计](#41-特性设计)  

**第一个参数expr支持数据类型**

|类型|yashan是否支持|oracle是否支持|
|---|---|---|
|整型组|否|--|
|number|否|否|
|binary_double|否|否|
|binary_float|否|否|
|char|**是**|否|
|nchar|**是**|否|
|varchar|是|是|
|nvarchar|是|是|
|clob|是|是|
|blob|是|是|
|nclob|是|是|
|raw|是|是|
|json|是|是|
|xmlType|否|否|
|date|否|否|
|timestamp|否|否|
|time|否|--|
|dsInterval|否|否|
|ymInterval|否|否|
|rowId|否|否|
|bool|否|--|
|bit|否|--|
|udt|否|否|


- expr为NULL时返回null
- expr不能转json时，会容忍报错，返回null
- expr支持绑定参数


###   [4.2 特性功能点2](#42-特性功能点2)  

**对于json路径表达式中函数支持**

1、当前路径表达式中支持的函数为count、size、type

2、由于json_value函数返回的是标量，因此对于type与size如果有多条结果匹配成功，则返回为null

###   [4.3 特性功能点3](#43-特性功能点3)  

** 函数实现**

1、parse阶段适配json format关键字

2、verify阶段与conclude合并，对参数做类型白名单校验

3、执行阶段流程：

- 执行第一个expr，如果是null直接返回； 然后转json类型，失败直接返回null
- 将jsonExpr数据读出，转成二进制json格式，其中第1个bit位表示json的类型（如object， array，number等）
- 解析jsonPath表达式
- 根据递归的对jsonExpr按jsonPath表达式记录格式进行匹配输出。如果匹配成功多次或者只需匹配一次但结果为object或array则直接返回null


###   [4.4 特性性能点2](#44-特性性能点2)  

###   [4.5 特性可维可测设计](#45-特性可维可测设计)  

###   [4.6 特性安全设计](#46-特性安全设计)  

###   [4.7 特性周边配合](#47-特性周边配合)  

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

设计开发人员自测用例（文字描述），给出开发者自测试的设计方案表格或者XMIND、开发自测的用例归档路径。

自测关注点：

1. 覆盖全面
1. 避免重复测试
1. 测试用例的可维护性


自测用例设计方法：

1. 边界值
1. 等价类
1. 正交


|测试场景|
|---|
|错误语法，错误拼写，在路径表达式后面再跟oracle语法|
|json format语法支持|
|jsonExpr为各个数据类型,且含能成功、失败转json|
|jsonExpr为常量，column，绑定参数|
|jsonExpr有array、object并嵌套|
|jsonExpr不同层存在同样的key|
|pathExpr为常量字符串与非常量字符串|
|路径表达式为 '$'/'$[0]'/'$[*]'/'$.key'|
|路径表达式中有函数|
|路径表达式写正确以及错误的key|


##   [6.资料设计章节](#6资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [7.未来规划](#7未来规划)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。

![](https://pingcode.yasdb.com/atlas/files/public/67396ddb8970c2af4f521582/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTI0NjEsImV4cCI6MTc4MjMyMzI2MX0.BGBqqD5Nd2DpJ8jk4us2Kn2iWONiTtI0gpnGLcJ6uEo)

## Attachments:

[image2024-8-5_15-51-30.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZGI4OTcwYzJhZjRmNTIxNTdmIiwicmVmX2lkIjoiNjczOTZkZGE1OTNmOTljOWZmMjM4MDQ2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEyNDYxLCJleHAiOjE3ODIzOTg4NjF9.sqYn9sPxPpDqsTNO7fneJXB1qYeyTJJKV9eu9EZQC1s)

 (image/png)    


[image2024-8-5_15-51-21.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZGI4OTcwYzJhZjRmNTIxNTgwIiwicmVmX2lkIjoiNjczOTZkZGE1OTNmOTljOWZmMjM4MDQ2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEyNDYxLCJleHAiOjE3ODIzOTg4NjF9.CFHp9tKd-l9pDHyYWmIkkRas3Yxh8csZHmqrRXmlaHE)

 (image/png)    


[image2023-6-2_15-22-12.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZGI4OTcwYzJhZjRmNTIxNTgxIiwicmVmX2lkIjoiNjczOTZkZGE1OTNmOTljOWZmMjM4MDQ2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEyNDYxLCJleHAiOjE3ODIzOTg4NjF9.T81hGtUb6whq8jPlxmjhKEZMNXumsx8GuAJ9cj04miA)

 (image/png)    
