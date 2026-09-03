Created by 韩晓盼, last modified on 十二月 08, 2023

SR：    [YDBRD-21728](https://jira.yasdb.com/browse/YDBRD-21728?src=confmacro)    -  to_char(number)支持千分位格式符  完成

# 1.   **概述**

本需求设计范围是to_char(number)支持千分位格式符    [，原生支持double类型](https://conf.yasdb.com/pages/viewpage.action?pageId=135624430)    。

# 2.   **需求分析**

**1、to_char函数介绍**

- **定义**


TO_CHAR函数将    [expr](https://cod-doc.yasdb.com/yashandb/alpha/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E9%80%9A%E7%94%A8SQL%E8%AF%AD%E6%B3%95/expr)    的值按format格式转换为CHAR/VARCHAR类型字符串数据；

- **语法**


  `to_char::= TO_CHAR "(" expr ["," format] ")"`  

- **参数限制**


根据支持类型可将TO_CHAR函数分为如下三类：

1. TO_CHAR（日期型）、TO_CHAR（日期型，FORMAT）：expr的值为日期型时，支持携带格式符；此时函数返回VARCHAR类型字符串数据。
1. TO_CHAR（数值型）、TO_CHAR（数值型，FORMAT）：expr的值为数值型时，支持携带格式符；此时函数返回VARCHAR类型字符串数据。
1. TO_CHAR（非日期/数值的其他类型）：expr的值为非日期/数值的其他类型时，不可携带格式符；当expr的值CHAR类型时，函数返回CHAR类型字符串数据，否则返回VARCHAR类型字符串数据。


当expr的值为NULL时，函数返回NULL。

于列存表中使用本函数时，expr不支持为行外存储的LOB类型。

于行存表中使用本函数时，如果expr是BINARY_DOUBLE类型，且其值超过NUMBER类型的表示范围时，本函数会返回数据溢出错误。expr为LOB类型时支持隐式转换。

** format**

指定转换的格式。

format支持中文年月日，须用双引号包围中文字符，expr中的中文字符无须用双引号包围。

更多介绍见文档：    [YashanDB Doc (yasdb.com)](https://cod-doc.yasdb.com/yashandb/alpha/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/TO_CHAR.html)  

  


**2、需求来源**

产品化需求

场景：部分函数规格列存已支持，当前行存该功能未实现

需求描述：TO_CHAR格式补充

需求范围：单机、分布式、集群、行表

需求规格：格式功能补充如下，千位分隔符：,，如'9,999'

***与22.2相比，新增：***    
  1、支持分布式、集群    
  2、函数的参数一，支持double类型（包含double边界值）    
  问题单转需求：    [[YDBRD-21353] CLONE-【TO_CHAR】单机行存中使用to_char函数，第一个参数类型为double并且取值范围超过number的情况下，报错YAS-00012 numeric overflow，结果没有和oracle保持一致 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-21353)  

  


**3、功能分析**

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


更多见开发文档：    [to_char(number,fmt)支持千分位格式符，原生支持double类型 - 唐嘉欣 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=135624430)  

# 3.   **测试设计方法**

边界值，等价类，场景分析等。

# 4.   **详细测试设计**

1）使用章节3的测试方法设计详细的测试点，可沿用xmind的方式

![](https://pingcode.yasdb.com/atlas/files/public/67396ba68970c2af4f520613/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFJQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBSUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTYwOTksImV4cCI6MTc4MjMwNjg5OX0.rKNQNPxSoBpUyg0-LPdsk9pdA8Aj_jf1qunbrR2M1uM)

2）梳理该特性是否涉各个专项测试，并在详细设计中描述具体测试点

|专项|是否涉及|
|---|---|
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


附件：

[to_char(number)支持千分位格式符测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYTY4OTcwYzJhZjRmNTIwNjBlIiwicmVmX2lkIjoiNjczOTZiYTY1OTNmOTljOWZmMjM2NTQwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2MDk5LCJleHAiOjE3ODIzODI0OTl9.EH31LmXA3c4nFzcKg3wPTBVedPgCLCaXPb4338A0_4E)

# 5.   **测试用例**

原有用例位置：    [standalone/testcase/function2/test_sdv_to_char_g · br22.2 · CoD-Test / yasft · GitLab (yasdb.com)](https://git.yasdb.com/cod-test/yasft/-/tree/br22.2/standalone/testcase/function2/test_sdv_to_char_g)      
  测试设计细化后的文本用例

详见附件

[冒烟用例及全量文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYTZhMWFkOWEzMzExZGM4NDg2IiwicmVmX2lkIjoiNjczOTZiYTY1OTNmOTljOWZmMjM2NTQwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2MDk5LCJleHAiOjE3ODIzODI0OTl9.HxdUaQlHCUfj3QvVvXZj-lQ8F6diQwwPureV3ZmVDAs)

# 6.   **测试框架设计**

1. 沿用guider框架


# 7.   **测试环境说明**

|服务器类型|操作系统|服务器个数|部署节点|
|:---|:---|:---|:---|
|VM|CentOS Linux release 7.9.2009 (Core)|1|  
|


## Attachments:

[image2023-12-5_16-32-32.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYTZhMWFkOWEzMzExZGM4NDg3IiwicmVmX2lkIjoiNjczOTZiYTY1OTNmOTljOWZmMjM2NTQwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2MDk5LCJleHAiOjE3ODIzODI0OTl9.x-0AYhnCeubxucLcifuGw61iiQI8ue3LQnOMVm2SZEU)

 (image/png)    


[image2023-12-4_18-23-39.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYTY4OTcwYzJhZjRmNTIwNjBmIiwicmVmX2lkIjoiNjczOTZiYTY1OTNmOTljOWZmMjM2NTQwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2MDk5LCJleHAiOjE3ODIzODI0OTl9.0XMSABUJUTMlCjSLsJZPNwgeHI1k08M9M5zsI2t8m4Y)

 (image/png)    


[to_char(number)支持千分位格式符测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYTY4OTcwYzJhZjRmNTIwNjEwIiwicmVmX2lkIjoiNjczOTZiYTY1OTNmOTljOWZmMjM2NTQwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2MDk5LCJleHAiOjE3ODIzODI0OTl9.lgmlCUZNsZkUjIZhyyv0EUoP1L66zmFqF6Bg2OOrQhc)

 (application/x-xmind)    


[image2023-12-5_18-17-46.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYTZhMWFkOWEzMzExZGM4NDg4IiwicmVmX2lkIjoiNjczOTZiYTY1OTNmOTljOWZmMjM2NTQwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2MDk5LCJleHAiOjE3ODIzODI0OTl9.VwB-_rV5HT4cpaI3vtOtuWnrSXPRTh-GUTBTrj0ln1I)

 (image/png)    


[to_char(number)支持千分位格式符测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYTY4OTcwYzJhZjRmNTIwNjBlIiwicmVmX2lkIjoiNjczOTZiYTY1OTNmOTljOWZmMjM2NTQwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2MDk5LCJleHAiOjE3ODIzODI0OTl9.EH31LmXA3c4nFzcKg3wPTBVedPgCLCaXPb4338A0_4E)

 (application/x-xmind)    


[冒烟用例及全量文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYTZhMWFkOWEzMzExZGM4NDg2IiwicmVmX2lkIjoiNjczOTZiYTY1OTNmOTljOWZmMjM2NTQwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2MDk5LCJleHAiOjE3ODIzODI0OTl9.HxdUaQlHCUfj3QvVvXZj-lQ8F6diQwwPureV3ZmVDAs)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,![](https://pingcode.yasdb.com/atlas/files/public/67396ba78970c2af4f520614/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFJQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBSUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTYwOTksImV4cCI6MTc4MjMwNjg5OX0.rKNQNPxSoBpUyg0-LPdsk9pdA8Aj_jf1qunbrR2M1uM),Posted by hanxiaopan at 十二月 06, 2023 16:10|
|---|
