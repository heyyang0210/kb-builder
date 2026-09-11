Created by 唐嘉欣, last modified on 一月 05, 2024

*详细设计-YDBRD-24354: TO_CHAR/TO_DATE Format Design（to_char/to_date格式符质量加固方案设计）*

* IR链接：*    [YDBRD-21423](https://jira.yasdb.com/browse/YDBRD-21423?src=confmacro)    *-*  *to_char/to_date支持iw、iyyy\iyy\iy\i、rrrr、sssss格式符*  *完成*

*SR链接：*    [YDBRD-24354](https://jira.yasdb.com/browse/YDBRD-24354?src=confmacro)    *-*  *to_char/to_date支持iw、iyyy\iyy\iy\i、rrrr、sssss格式符*  *完成*

##   [1. 总述](#1-总述)  

主要针对tochar、todate函数的iw、iyyy\iyy\iy\i、rrrr、sssss格式符进行质量加固。

需求部署形态：单机和集群、行表。

###   [1.1 需求来源](#11-需求来源)  

研发内部23.2版本质量加固

###   [1.2 调研文档](#12-调研文档)  

  [https://conf.yasdb.com/pages/viewpage.action?pageId=135594795](https://conf.yasdb.com/pages/viewpage.action?pageId=135594795)  

RR/RRRR调研文档：    [https://conf.yasdb.com/pages/viewpage.action?pageId=141570947](https://conf.yasdb.com/pages/viewpage.action?pageId=141570947)  

###   [1.3 需求分析](#13-需求分析)  

####   [1.3.1 支持tochar函数的iw、iyyy\iyy\iy\i、rrrr、sssss格式符；](#131-支持tochar函数的iwiyyyiyyiyirrrrsssss格式符)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|---|---|---|---|---|
|功能1|to_char(datetime, 'iw')|在ISO格式下，返回日期参数在一年中的周数（1~53）|是|是|
|功能2|to_char(datetime, 'iyyy\iyy\iy\i')|在ISO格式下，返回日期参数对应ISO年份|是|是|
|功能3|to_char(datetime, 'rrrr')|返回日期参数的年份|是|是|
|功能4|to_char(datetime, 'sssss')|返回一天经历的总秒数|是|是|
|性能|性能场景1||否|否|
|可用性|恢复场景|----|否|否|
|可靠性|故障场景|----|否|否|
|可维可测|DFX功能1|----|否|否|
|安全|安全场景1|----|否|否|
|易用性|----|----|否|否|
|可修改性|----|----|否|否|
|兼容性|----|----|否|否|
|周边配合|权限|----|----|否|
|周边配合|审计|----|----|否|
|周边配合|导入导出工具|----|----|否|


####   [1.3.2 支持todate函数的rrrr、sssss格式符，拦截iw、iyyy\iyy\iy\i格式符。](#132-支持todate函数的rrrrsssss格式符拦截iwiyyyiyyiyi格式符)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|---|---|---|---|---|
|功能1|to_date(string, 'rrrr')|和对应年份匹配，等价于yyyy|是|是|
|功能2|to_date(string, 'sssss')|匹配当天总秒数|是|是|
|功能3|to_date(string, 'iyyy\iyy\iy\i')|拦截报错|是|是|
|功能4|to_date(string, 'iw')|拦截报错|是|是|
|性能|性能场景1||否|否|
|可用性|恢复场景|----|否|否|
|可靠性|故障场景|----|否|否|
|可维可测|DFX功能1|----|否|否|
|安全|安全场景1|----|否|否|
|易用性|----|----|否|否|
|可修改性|----|----|否|否|
|兼容性|----|----|否|否|
|周边配合|权限|----|----|否|
|周边配合|审计|----|----|否|
|周边配合|导入导出工具|----|----|否|


###   [1.4 数据字典](#14-数据字典)  

|术语|描述|借鉴业界|参考|
|---|---|---|---|
|无||||


###   [1.5 开源依赖](#15-开源依赖)  

没有依赖的开源组件

##   [2. 接口](#2-接口)  

|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|SQL语法|----|----|否|
|SQL语法|----|----|否|
|函数1|to_char(datetime,  fmt ) 返回日期|tochar函数接口codDateTextConcatElement()；‘iyyy\iyy\iy\i' 接口函数codCalIsoYear()；  ‘iw’接口函数codDateElmtISOWeekOfYear()；|是|
|函数2|to_date(string,fmt) 返回fmt对应字符串|todate函数接口dateAddElement(); ‘rrrr’接口函数dateAddYearElement() ; ‘sssss’接口函数dateAddSecondOfDayElement()|是|
|高级包|----|----|否|
|系统视图|----|----|否|
|动态视图|----|----|否|
|配置参数|----|----|否|
|驱动接口|----|----|否|
|错误码|----|----|否|
|告警|----|----|否|
|日志|----|----|否|


##   [3. 规格与约束](#3-规格与约束)  

1. YashanDB采用外推格  *历*  高利  *历*  ，1582年10月15号（不包括15号）之前与Oracle历法不一致。


##   [4. 特性](#4-特性)  

###   [4.1 特性设计](#41-特性设计)  

to_char

|SQL|RESULT|
|---|---|
|select to_char(to_date('2015-01-01','yyyy-mm-dd'), 'iyyy') from dual;||
|select to_char(to_date('2022-01-01','yyyy-mm-dd'), 'iw') from dual;||
|select to_char(to_date('2022-01-03','yyyy-mm-dd'), 'rrrr') from dual;||
|select to_char(to_date('2022-01-03 1:0:0','yyyy-mm-dd hh24:mi:ss'), 'sssss') from dual;||


to_date

|SQL|RESULT|
|---|---|
|select to_date('2021','iyyy') from dual;|报错|
|select to_date('2021-10-15 1:0:0 3600','yyyy-mm-dd hh24:mi:ss sssss') from dual;|执行成功|
|select to_date('2021-10-15 1:1:1 3600','yyyy-mm-dd hh24:mi:ss sssss') from dual;|报错，sssss和实际时分秒不匹配|
|select to_date('2021-10-15','rrrr-mm-dd') from dual;|执行成功|


###   [4.2 特性功能点1](#42-特性功能点1)  

非ISO格式：新年的第一天永远为第一周的星期一，7天为一周，第一周一定有7天，最后一周不足七天。

ISO格式：新年的第一个天以当天星期几为准，到周日为一周，每周都一定为7天； 当去年最后一周不足7天，则用今年第一周补或者延续到今年第一周（具体规则见下方详情）。

to_char函数：

1. iyyy
1. 返回ISO年。根据输入的年月日进行判断，当日期落在第一周，如果这一周不足4天（1月1日是周五以及之后），则补上一年的最后一周，ISO年为去年； 同理，当日期落在最后一周，且这周不足4天（最后一天是周三以及之前），则补明年的第一周，ISO年为明年；其余时间ISO年都为输入的年份。
1. iw
1. 返回ISO标准周。每年最多有53个周，当52周之后剩余天数大于等于4天，则定位53周。
1. 判断逻辑和ISO年一致，当日期落在第一周，如果这一周不足4天（1月1日是周五以及之后），则补上一年的最后一周； 当日期落在最后一周，且这周不足4天（最后一天是周三以及之前），则补明年的第一周。


###   [4.3 特性功能点2](#43-特性功能点2)  

to_char/to_date函数的rrrr格式符：

全年。接受4位或2位输入。如果是2位数，则提供与RR相同的返回值。如果不需要此功能，请输入4位数的年份。

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

**iw、iyyy/iyy/iy/i：**

1. 测试1月1日为周一、周二、周三、周四、周五、周六、周日的年份，例如：2018, 2019, 2020, 2015, 2016, 2022, 2023
1. 测试12月31日为周一、周二、周三、周四、周五、周六、周日的年份


**rrrr：**

1. 测试边界年份：00年、49年、50年、99年
1. 修改系统时钟为上述边界年份，再测试


**sssss：**

1. 测试to_date同时使用sssss和hh24/hh12/mi/ss的情况校验是否正确
1. 测试to_char的sssss输出是否正确


##   [6.资料设计章节](#6资料设计章节)  

完善文档：/开发手册/SQL参考手册/内置函数/TO_CHAR, TO_DATE

##   [7.未来规划](#7未来规划)  

## Attachments:

## Comments:

|  [](null)  ,评审纪要：,- 需求只实现7个格式符，质量加固后续做
- 梳理to_char/to_date、格式符的逻辑
,Posted by tangjiaxin at 一月 03, 2024 11:46|
|---|
|  [](null)  ,oracle的time没有分数秒，有四舍五入的情况；yashandb的time有分数秒，没有四舍五入，存在差异,![](https://pingcode.yasdb.com/atlas/files/public/67396c28a1ad9a3311dc87fe/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUVBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTk0MjEsImV4cCI6MTc4MjMxMDIyMX0.3OMPHPNjdZ3WOFP3K42rpo9n1cJ9_sEx0b4_8y5b7_c),Posted by tangjiaxin at 一月 11, 2024 11:04|
