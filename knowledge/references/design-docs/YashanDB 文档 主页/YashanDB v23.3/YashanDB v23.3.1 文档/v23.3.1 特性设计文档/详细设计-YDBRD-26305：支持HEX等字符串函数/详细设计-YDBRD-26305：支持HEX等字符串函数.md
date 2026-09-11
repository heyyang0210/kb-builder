Created by 邓秋怡, last modified on 六月 25, 2024

*详细设计-YDBRD-26305 : 支持HEX等字符串函数方案设计*

*IR链接：*    [YASHAN-290](https://pingcode.yasdb.com/ship/ideas/660b743f009f91eb87f2b072#YASHAN-290)      
  *SR链接：*    [YDBRD-26305](https://pingcode.yasdb.com/pjm/items/66193039fd997db58ad8a81d#YDBRD-26305)  

  


##   [1. 总述](#1-总述)  

支持HEX等字符串函数的使用，与Mysql 5.7对齐

###   [1.1 需求来源](#11-需求来源)  

Mysql兼容性支持    
  支持形态：单机

###   [1.2 调研文档](#12-调研文档)  

调研文档见    [HEX等字符串函数调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=150626717)  

###   [1.3 需求分析](#13-需求分析)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|---|---|---|---|---|
|HEX(STR)\HEX(N)|对输入的字符串或数字，函数返回字符串的十六进制形式或返回数值的十六进制。|HEX(N)下对不能直接以bigint表示的数据报错或强制转换成bigint后统一处理|是|是|
|OCT(SRT)/OCT(N)|对输入的字符串或数字，函数返回字符串转换成数值后的八进制形式或直接返回数值的八进制。|1、对不能直接以bigint表示的数据报错或强制转换成bigint后统一处理 2、字符串转换成数值过程中进行非法字符截断（不允许科学计数）|是|是|
|STRCMP(STR1,STR2)|对输入的两个字符串进行比较，返回比较结果。|暂无|是|是|
|FORMAT(X,D,[LACALE])|将输入的数据四舍五入到小数点后指定位数，然后转换成千分位数，再用指定语言格式输出。|字符串转换成数字过程中进行非法字符截断（X,D的截断方式不同，X允许科学计数，D不允许科学计数）|是|是|
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


##   [2. 接口](#2-接口)  

##   [3. 规格与约束](#3-规格与约束)  

与Mysql差异：

1. MYSQL中STRCMP结果会受字符序影响，YASHAN目前STRCMP的比较结果和filter相同，大小写敏感，字符序合入后，将由字符序影响。
1. MYSQL中空串和null不等价，YASHAN目前二者等价。在STRCMP时遵循YASHAN的规则。
1. MYSQL中FORMAT的结果会受第三个参数locale的影响，YASHAN目前FORMAT第三个参数的功能暂时未实现，编译阶段拦截。
1. MYSQL中OCT,HEX溢出（[-2  63  ,2  64  -1]外）后会输出一个不变的数据或无法理解的数据，YASHAN目前OCT,HEX溢出后会直接报错。
1. 在数据类型相关的需求合入前，与mysql同名但表现不一致的类型（如mysql不支持clob，且blob对应yashan的clob），内置函数的表现结果与yashan的逻辑对齐。


##   [4. 特性](#4-特性)  

###   [4.1 特性设计](#41-特性设计)  

###   [4.1.1 HEX/OCT](#411-hexoct)  

- HEX：    
  对字符串参数，直接取bytes通过varConvBytes2HexStr转换成十六进制字符串类型。    
  对数值参数，int64下界至  **uint64**  上界外的，直接报错。int64下界至int64上界的，直接转为bigint类型（小数四舍五入成整数）。int64上界至  **uint64**  上界的，强转为bigint类型。统一为bigint后，取vint64处的二进制转换为十六进制字符串。
- OCT：    
  对字符串参数，以非科学计数法且非法字符直接截断（不是报错）的方式将字符串解析成number类型，再转成bigint类型，取vint64处的二进制转换为八进制字符串。    
  对数值参数，处理流程参照HEX数值参数处理流程（区别是oct对小数是直接截断成整数）。


![](https://pingcode.yasdb.com/atlas/files/public/67396ee38970c2af4f521c27/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFnPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NDQ3MzgsImV4cCI6MTc4MjQ1NTUzOH0.t6j9__pIL8P919KxrN458nd2QLBqzqd0kjYBVZ-b414)

###   [4.1.3 STRCMP](#413-strcmp)  

把两个参数都转换成varchar类型后直接调用varCompare接口获取返回结果。（字符序相关内容在接口里面处理，转测在后续迭代，当前默认字符序utf8mb4_general_ci）

###   [4.1.4 FORMAT](#414-format)  

- 第一个参数srcNumber    
  数值型：CodDigit2Number统一成number类型数据。    
  字符串型：以  **科学计数法**  的且非法字符截断的形式解析成number类型。
- 第二个参数scale    
  数值型：CodDigit2Number统一成number类型数据，小于0则置0，然后转换成uint64(调研结果显式mysql实际有效小数位数为33)。（小数四舍五入成整数）    
  字符串型：以  **非科学计数法**  的且非法字符截断的形式解析成number类型。
- 第三个参数locale    
  省略则默认'en_US'。（其他是否支持待定）
- 二者结合后    
  先用scale对srcNumber进行四舍五入，再将srcNumber转换成string，从小数点从左数每三位加','，小数点往右数，长度不够scale补字符'0';


![](https://pingcode.yasdb.com/atlas/files/public/67396ee3a1ad9a3311dc9a9b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFnPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NDQ3MzgsImV4cCI6MTc4MjQ1NTUzOH0.t6j9__pIL8P919KxrN458nd2QLBqzqd0kjYBVZ-b414)

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

- HEX：溢出，负数，小数
- OCT：溢出，负数，小数，字符串类型的参数不识别科学计数且非法字符截断忽略后续
- STRCMP：字符串-字符串、字符串-数字、数字-数字
- FORMAT：溢出、字符串类型的参数不同的识别与截断方式、


##   [6.资料设计章节](#6资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [7.未来规划](#7未来规划)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。

## Attachments:

[image2024-4-25_10-28-22.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZTJhMWFkOWEzMzExZGM5YTk5IiwicmVmX2lkIjoiNjczOTZlZTI3MjgyMDZlZmI5MmYyZGVmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDQ0NzM4LCJleHAiOjE3ODI1MzExMzh9.zoW1Cn7Pp2uBuQIF1hmcbjgPrx_Tyur8ryXrwSWs0Jk)

 (image/png)    


[image2024-4-25_10-24-58.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZTM4OTcwYzJhZjRmNTIxYzI2IiwicmVmX2lkIjoiNjczOTZlZTI3MjgyMDZlZmI5MmYyZGVmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDQ0NzM4LCJleHAiOjE3ODI1MzExMzh9.NM6TTfPSkOkY8gQ5YGeMWX96oQROxuI9m75xC3422vQ)

 (image/png)    
