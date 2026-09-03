Created by 胡晓畔, last modified on 十二月 11, 2023

# **1.**  ** **  **概述**

  


SR：    [[YDBRD-13217] 支持median窗口函数 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-13217)  

此SR测试median函数支持，是对某一列数据或者表达式求中位数，  中位数是按顺序排列的一组数据中居于中间位置的数。

假设用于求median的数据其中一个窗口数据共有N个，排序后为X  1 ..... N,  

当N为奇数时，median函数返回X  (n + 1) /2，  

当N为偶数时，median函数返回(（X  (n + 1) /2   ）- X  n/2  ) / 2 + (X  n/2  )

在单行计算中，当expr的值为NULL时，函数返回NULL。

在多行计算中，函数将忽略expr值为空的行，当所有行均为空时，计算结果为NULL。

# **2.**  ** **  **需求分析**

  


开发文档：    [窗口函数 median - 胡波洋 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=104202643)  

规格对齐Oracle

  


# **3**  **.**  ** **  **详细测试设计**

  


1.当前仅支持  median窗口函数，普通聚集函数暂时未支持

2.  参数类型为数值类型，时间类型或者时间间隔类型，其他类型暂不支持

3.单行计算时对null返回null；多行计算时忽略为null的行

4.函数返回值按以下处理

|  
,expr类型|返回值类型|
|---|---|
|tinyint|number|
|smallint|number|
|int|number|
|bigint|number|
|float|float|
|double|double|
|number|number|
|date|date|
|timestamp|timestamp|
|time|time|
|interval|interval|
|其他|报错|


5.当前  不支持在expr前加DISTINCT

6.over中禁用order by

7.不支持可隐式转换为数值型的字符入参

  


![](https://pingcode.yasdb.com/atlas/files/public/67396976a1ad9a3311dc76a8/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDY4NDUsImV4cCI6MTc4MjIxNzY0NX0.Sr5Zi2oKgNeQ6lvyZ7lXrDCAYH-3bgsnXn7TaXc7FuM)

  


[支持median窗口函数测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NzZhMWFkOWEzMzExZGM3NmE2IiwicmVmX2lkIjoiNjczOTY5NzY1OTNmOTljOWZmMjM0ZjFlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA2ODQ1LCJleHAiOjE3ODIyOTMyNDV9.qH4MpmEsbln_imW7uSrlYGlCDRkVuZa7OImwZUBQQFk)

# **4.**  ** **  **测试用例**

  [standalone/testcase/function2/median · master · CoD-Test / yasft · GitLab (yasdb.com)](https://git.yasdb.com/cod-test/yasft/-/tree/master/standalone/testcase/function2/median)  

# **5.**  ** **  **测试框架设计**

Guider+ yasft框架

# **6.**  ** **  **测试环境说明**

VM  CentOS Linux release 7.9.2009  3.10.0-1160.el7.x86_64  

CPU GenuineIntel  Intel(R) Xeon(R) Gold 6230R CPU @ 2.10GHz

单机normal

## Attachments:

[image2023-4-25_15-52-37.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NzZhMWFkOWEzMzExZGM3NmE3IiwicmVmX2lkIjoiNjczOTY5NzY1OTNmOTljOWZmMjM0ZjFlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA2ODQ1LCJleHAiOjE3ODIyOTMyNDV9.ZfEe5Ka1zWyvjGGq778gJK8meszjK6ubxTzqt1Q3k9s)

 (image/png)    


[支持median窗口函数测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NzZhMWFkOWEzMzExZGM3NmE2IiwicmVmX2lkIjoiNjczOTY5NzY1OTNmOTljOWZmMjM0ZjFlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA2ODQ1LCJleHAiOjE3ODIyOTMyNDV9.qH4MpmEsbln_imW7uSrlYGlCDRkVuZa7OImwZUBQQFk)

 (application/x-xmind)    
