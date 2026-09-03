Created by 唐嘉欣, last modified on 十二月 05, 2023

*详细设计-YDBRD-21728: to_char(number,fmt)支持千分位格式符，原生支持double类型*

* IR链接：*    [YDBRD-20329](https://jira.yasdb.com/browse/YDBRD-20329?src=confmacro)    *-*  *TO_CHAR格式补充，包含千分位分位等*  *完成*

*SR链接：*    [YDBRD-21728](https://jira.yasdb.com/browse/YDBRD-21728?src=confmacro)    *-*  *to_char(number)支持千分位格式符*  *完成*

##   [1. 总述](#1-总述)  

给定一个数值型参数和一个格式字符串，输出数值型转字符串型的结果，支持千分位分位

例如：to_char(12345, '99,999') -> '12,345'

###   [1.1 需求来源](#11-需求来源)  

产品化需求

场景：部分函数规格列存已支持，当前行存该功能未实现

需求描述：TO_CHAR格式补充

需求范围：单机、分布式、集群、行表

需求规格：格式功能补充如下，千位分隔符：,，如'9,999'

###   [1.2 调研文档](#12-调研文档)  

###   [1.3 需求分析](#13-需求分析)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|---|---|---|---|---|
|功能|to_char支持千分位格式符|使用64位比特位图记录千分位位置|否|是|
|功能|to_char原生支持double类型|将double类型转换为统一的中间结构体|否|是|
|性能|----|----|否|否|
|可用性|----|----|否|否|
|可靠性|----|----|否|否|
|可维可测|----|----|否|否|
|安全|----|----|否|否|
|易用性|----|----|否|否|
|可修改性|----||否|否|
|兼容性|----|----|否|否|
|周边配合|权限|----|----|否|
|周边配合|审计|----|----|否|
|周边配合|导入导出工具|----|----|否|


千分位格式符如下：

|Element|Example|Description|Postgre|Oracle|Anchorbase|Crab|
|---|---|---|---|---|---|---|
|, (comma)|to_char(1111,'9,999') → 1,111|代表千位分隔符，可以在数字型格式字符串中多次指定。,- 在数字型格式字符串中不可开头使用。
- 在数字型格式字符串中不能出现在小数后（小数点右边）。
- 千位分隔符可以连续使用，也可以在小数点前使用。
- 千位分隔符不可在科学计数法中使用
- 不可与G同时出现
|**支持**|**支持**|支持|支持|
|G|SQL> select to_char(3333,'9G999') from dual;,TO_CHA    
  ------    
  3,333|在指定位置返回千位分隔符（即NLS_NUMERIC_CHARACTER的当前值）。,  
,- 与comma（，）一致，且不可与comma（，）同时出现
|**支持**|**支持**|支持|支持|


###   [1.4 数据字典](#14-数据字典)  

|术语|描述|借鉴业界|参考|
|---|---|---|---|
|无|---|---|---|


###   [1.5 开源依赖](#15-开源依赖)  

暂无依赖的开源组件

##   [2. 接口](#2-接口)  

|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|SQL语法|----|----|否|
|SQL语法|----|----|否|
|函数|to_char(number,fmt)|fmt新增了千分位格式符'G'和','|是|
|高级包|----|----|否|
|系统视图|----|----|否|
|动态视图|----|----|否|
|配置参数|----|----|否|
|驱动接口|----|----|否|
|错误码|----|----|否|
|告警|----|----|否|
|日志|----|----|否|


##   [3. 规格与约束](#3-规格与约束)  

- 在数字型格式字符串中不可开头使用。
- 在数字型格式字符串中不能出现在小数后（小数点右边）。
- 千位分隔符可以连续使用，也可以在小数点前使用。
- 千位分隔符不可在科学计数法中使用
- ','不可与'G'同时出现


##   [4. 特性](#4-特性)  

包括用例描述、ER图、数据流图、状态机切换等

###   [4.1 特性设计](#41-特性设计)  

**用例描述**

|用例名称|数值数据转换为带千分位的字符串||
|---|---|---|
|用例ID|  
||
|角色|普通用户||
|用例说明|用例主要功能是将数值型数据（number，float，double）转换为字符串，需要输出千分位分隔符||
|前置条件|打开数据库，准备好待转换的数值型数据，提前想好字符串的目标格式||
|基本事件流|参与者动作|系统响应|
|  
|1. 用户输入sql语句，调用to_char内置函数，第一个参数输入数值型数据，第二个参数输入格式符
|1. 数据库校验第一个参数是否为数值型数据，第二个参数的格式符是否合法。
1. 数据库解析格式符中千分位和数字的相对位置，根据相对位置关系，输出字符串时在对应位置加上千分位分隔符
|
|其他事件流|无||
|异常事件流|参与者动作|系统响应|
|  
|1. 第一个参数输入其他数据类型
1. 输入不合法的格式符
1. 第一个参数输入超过规格范围的数值型数据
1. 第二个参数输入其他类型数据
|1. 报错提示类型错误
1. 报错提示格式符不合法
1. 报错提示数据溢出
1. 报错提示类型错误
|
|后置条件|成功将数值数据转化为带千分位分隔符的字符串||


**数据流图**

![](https://pingcode.yasdb.com/atlas/files/public/67396c298970c2af4f520996/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFnQUNBQUFBQUFBQkFBQUFBQUFFQUFJQUFBQUFBRUFBQUVBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUNBQUFBQUVBQUFBQ0JBQUFBQUFBQUFBQUFBQUFBQUFBQUNDQUFFQUFBQUFBQ0FBQUFBQUFBQWdBUUFBQUFBQUFBS0FBQUFBRVFBRUFBRUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTk0NTEsImV4cCI6MTc4MjMxMDI1MX0.9eiZcAUc8sSsDopORrHQz2nPrSX4B_cRvbaIdcGUVJk)

###   [4.2 特性功能点1——支持千分位格式符](#42-特性功能点1支持千分位格式符)  

实现支持千分位格式符需要记录千分位和数字的相对位置，因为格式符最大长度规格为64，因此可以使用一个64位的CodUint64变量来作为比特位图，位图遵循以下规则：

- **每一位如果是1则表示该位置是千分位**
- **每一位如果是0则表示该位置不是千分位**


位图挂在DigitFmt结构体上，在解析Fmt格式符串时，生成比特位图

注意，比特位图使用时是破坏性的读，不可重复使用

**数据结构**

![](https://pingcode.yasdb.com/atlas/files/public/67396c29a1ad9a3311dc8804/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFnQUNBQUFBQUFBQkFBQUFBQUFFQUFJQUFBQUFBRUFBQUVBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUNBQUFBQUVBQUFBQ0JBQUFBQUFBQUFBQUFBQUFBQUFBQUNDQUFFQUFBQUFBQ0FBQUFBQUFBQWdBUUFBQUFBQUFBS0FBQUFBRVFBRUFBRUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTk0NTEsImV4cCI6MTc4MjMxMDI1MX0.9eiZcAUc8sSsDopORrHQz2nPrSX4B_cRvbaIdcGUVJk)

**生成千分位比特位图的状态机**

![](https://pingcode.yasdb.com/atlas/files/public/67396c29a1ad9a3311dc8805/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFnQUNBQUFBQUFBQkFBQUFBQUFFQUFJQUFBQUFBRUFBQUVBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUNBQUFBQUVBQUFBQ0JBQUFBQUFBQUFBQUFBQUFBQUFBQUNDQUFFQUFBQUFBQ0FBQUFBQUFBQWdBUUFBQUFBQUFBS0FBQUFBRVFBRUFBRUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTk0NTEsImV4cCI6MTc4MjMxMDI1MX0.9eiZcAUc8sSsDopORrHQz2nPrSX4B_cRvbaIdcGUVJk)

**使用千分位比特位图的状态机**

![](https://pingcode.yasdb.com/atlas/files/public/67396c298970c2af4f520997/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFnQUNBQUFBQUFBQkFBQUFBQUFFQUFJQUFBQUFBRUFBQUVBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUNBQUFBQUVBQUFBQ0JBQUFBQUFBQUFBQUFBQUFBQUFBQUNDQUFFQUFBQUFBQ0FBQUFBQUFBQWdBUUFBQUFBQUFBS0FBQUFBRVFBRUFBRUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTk0NTEsImV4cCI6MTc4MjMxMDI1MX0.9eiZcAUc8sSsDopORrHQz2nPrSX4B_cRvbaIdcGUVJk)

###   [4.3 特性功能点2——原生支持double类型](#43-特性功能点2原生支持double类型)  

将to_char(number,fmt)的过程抽象为三个中间过程：

1. 将数值型数据转换为科学计数法的中间结构体；
1. 将格式符数据转换为中间结构体；
1. 利用两个中间结构体，输出目标字符串


数据流图如下：

![](https://pingcode.yasdb.com/atlas/files/public/67396c29a1ad9a3311dc8806/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFnQUNBQUFBQUFBQkFBQUFBQUFFQUFJQUFBQUFBRUFBQUVBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUNBQUFBQUVBQUFBQ0JBQUFBQUFBQUFBQUFBQUFBQUFBQUNDQUFFQUFBQUFBQ0FBQUFBQUFBQWdBUUFBQUFBQUFBS0FBQUFBRVFBRUFBRUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTk0NTEsImV4cCI6MTc4MjMxMDI1MX0.9eiZcAUc8sSsDopORrHQz2nPrSX4B_cRvbaIdcGUVJk)

使用该框架，原生支持double类型只需要实现double->NumberForSciInfo的转换函数即可

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

- 千分位格式符的基本场景：to_char(1998, '9G999')
- 千分位在边界位置的场景
- 千分位和其他格式符混搭的场景
- 格式符为nchar的场景
- 数值型为double的场景、溢出number规格上限的场景
- 不合法的格式符的场景，观察是否正常报错


##   [6.资料设计章节](#6资料设计章节)  

##   [7.未来规划](#7未来规划)  

其他格式符、nls参数

优化整改函数框架，实现高可拓展性，方便后续格式符的添加

## Attachments:

[image2023-12-1_16-28-16.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMjhhMWFkOWEzMzExZGM4ODAxIiwicmVmX2lkIjoiNjczOTZjMjg3MjgyMDZlZmI5MmYwZTcyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5NDUxLCJleHAiOjE3ODIzODU4NTF9.MiihLWvbvwK3nwLjDoFQwb32hcyvbMpHEfqvZ7Gf4uM)

 (image/png)    


[image2023-12-1_16-28-51.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMjg4OTcwYzJhZjRmNTIwOTkyIiwicmVmX2lkIjoiNjczOTZjMjg3MjgyMDZlZmI5MmYwZTcyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5NDUxLCJleHAiOjE3ODIzODU4NTF9.zJQ-L0PAdOsos0bZ5OY0mZOyMIHX3ZQz--QwfpUOXm0)

 (image/png)    


## Comments:

|  [](null)  ,对fmt的校验是不是可以考虑放在执行阶段？,Posted by tangjiaxin at 十二月 01, 2023 18:11|
|---|
|  [](null)  ,暂不修改,Posted by tangjiaxin at 十二月 14, 2023 09:35|
|  [](null)  ,修改了to_char的verify判断，提前拦截了非法的comma（,）格式符，因此列存关于comma（,）格式符的报错输出有变动,![](https://conf.yasdb.com/download/attachments/130147054/image2023-9-25_10-53-5.png?version=1&modificationDate=1697014228000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFnQUNBQUFBQUFBQkFBQUFBQUFFQUFJQUFBQUFBRUFBQUVBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUNBQUFBQUVBQUFBQ0JBQUFBQUFBQUFBQUFBQUFBQUFBQUNDQUFFQUFBQUFBQ0FBQUFBQUFBQWdBUUFBQUFBQUFBS0FBQUFBRVFBRUFBRUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTk0NTEsImV4cCI6MTc4MjMxMDI1MX0.9eiZcAUc8sSsDopORrHQz2nPrSX4B_cRvbaIdcGUVJk),![](https://conf.yasdb.com/download/attachments/130147054/image2023-9-25_10-52-22.png?version=1&modificationDate=1697014228000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFnQUNBQUFBQUFBQkFBQUFBQUFFQUFJQUFBQUFBRUFBQUVBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUNBQUFBQUVBQUFBQ0JBQUFBQUFBQUFBQUFBQUFBQUFBQUNDQUFFQUFBQUFBQ0FBQUFBQUFBQWdBUUFBQUFBQUFBS0FBQUFBRVFBRUFBRUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTk0NTEsImV4cCI6MTc4MjMxMDI1MX0.9eiZcAUc8sSsDopORrHQz2nPrSX4B_cRvbaIdcGUVJk),Posted by tangjiaxin at 十二月 14, 2023 19:31|
|  [](null)  ,可以通过d测试double常量，比如：select to_char(1.23e200d, '9999') from sys.dual;,Posted by tangjiaxin at 十二月 14, 2023 19:33|
|  [](null)  ,float还是继续走number的分支，oracle的float可能是先转number再to_char的，如果先转double再to_char结果会出现不一致的情况,Posted by tangjiaxin at 十二月 19, 2023 20:10|
