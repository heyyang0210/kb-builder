Created by 程康, last modified on 七月 10, 2024

##   [1. 总述](#1-总述)  

exp 导出csv文件，可指定sql   导出结果集

###   [1.1 需求来源](#11-需求来源)  

###   [1.2 调研文档](#12-调研文档)  

  [Oracle 大数据量导出工具——sqluldr2 的安装与使用-腾讯云开发者社区-腾讯云 (tencent.com)](https://cloud.tencent.com/developer/article/2324319)  

![](https://pingcode.yasdb.com/atlas/files/public/67396d33a1ad9a3311dc8f70/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDY1MTgsImV4cCI6MTc4MjMxNzMxOH0.fCQns2qD8wFE4WFXjy2xSjkcxzjCQQTzSlkfghFvQHU)

###   [1.3 需求分析](#13-需求分析)  

  [1.4 数据字典](#14-数据字典)  

###   [1.5 开源依赖](#15-开源依赖)  

不涉及

##   [2. 接口](#2-接口)  

  


```
命令行参数：
exp --csv -f csv -u regress -p regress --query "select * from regress.ck_test where a=1" 
exp --csv -f csv -u regress -p regress --query "select id,name from ck_test" --query-out-file f1
exp --csv -f csv -u regress -p regress --query "select id from ck_test" -qo f2

exp --csv -f csv -u regress -p regress --query-file "t1.sql" -qo f3
exp --csv -f csv -u regress -p regress --qf "t2.sql" -qo f4


配置文件：
query= select id1 from t1
```

新增参数 

|参数|缩写|默认值|校验|
|---|---|---|---|
|--query|-q|空|与 -O -T 互斥,use-thread = 1|
|--query-file|-qf|空|-T 指定时，不生效,use-thread = 1|
|--query-out-file|-qo|空|-q 或 -qf 指定时 生效,与 -T 互斥|


  


-q -qf 仅支持单条sql语句

-q 参数仅支持单行语句，不支持有注释、 换行 

-qf 可在文件中支持 注释、换行

-q 与 -qf 同时指定时，以 -q 为准

  


配置参数和配置文件同时指定 相同的参数，以配置参数为准

##   [3. 规格与约束](#3-规格与约束)  

  


输入方式：

命令行：双引号包围，注意转义，例如：

双引号  --query "select * from test3 where c1 = '\"'"   单引号 --query "select * from test3 where c1 = ''''"

  
    
  ctl文件：不需要双引号包围

  


、支持表名前指定schema，不指定schema时 默认schema为 -u

##   [4. 特性](#4-特性)  

  


、输入的sql仅支持 dql

、支持命令行输入，配置文件输入

、不涉及修改导出文件路径的逻辑，可用 -F 配置导出路径

、支持指定分隔符、包围符

、导出文件名不指定则默认为 outfile

、导出sql限制 2M

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

##   [6.资料设计章节](#6资料设计章节)  

新增相关 文档描述

##   [7.未来规划](#7未来规划)  

## Attachments:

[image2024-5-24_14-57-44.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMzI4OTcwYzJhZjRmNTIxMGY2IiwicmVmX2lkIjoiNjczOTZkMzI3MjgyMDZlZmI5MmYxYzMwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2NTE4LCJleHAiOjE3ODIzOTI5MTh9.bIAWnttzmU1TFSKlgKhvszRcJIxnfXrFaOEkLjFFVaM)

 (image/png)    


[image2024-5-24_14-54-46.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMzJhMWFkOWEzMzExZGM4ZjY3IiwicmVmX2lkIjoiNjczOTZkMzI3MjgyMDZlZmI5MmYxYzMwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2NTE4LCJleHAiOjE3ODIzOTI5MTh9.vHDrgYocdT-rVfQrJRJ0qQc_9jZRWE6dFaacF1bN6Ig)

 (image/png)    


[image2024-5-24_14-26-24.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMzJhMWFkOWEzMzExZGM4ZjY4IiwicmVmX2lkIjoiNjczOTZkMzI3MjgyMDZlZmI5MmYxYzMwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2NTE4LCJleHAiOjE3ODIzOTI5MTh9.eQzADZJaDK_CC_yx0uzYMNtl9z6fixmLIsZY9tf-QpA)

 (image/png)    


[image2024-5-24_14-25-7.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMzI4OTcwYzJhZjRmNTIxMGY3IiwicmVmX2lkIjoiNjczOTZkMzI3MjgyMDZlZmI5MmYxYzMwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2NTE4LCJleHAiOjE3ODIzOTI5MTh9.HmpCmSJPtHQqJDOD23WBX16voVFwSISxydQ9EbGOmb8)

 (image/png)    


[image2024-5-24_14-24-54.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMzI4OTcwYzJhZjRmNTIxMGY4IiwicmVmX2lkIjoiNjczOTZkMzI3MjgyMDZlZmI5MmYxYzMwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2NTE4LCJleHAiOjE3ODIzOTI5MTh9.rx74m2B0jLPN_rk_POa_n8iDjVTsgzTlR_x3QnPJFhU)

 (image/png)    


[image2024-5-24_14-15-50.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMzI4OTcwYzJhZjRmNTIxMGY5IiwicmVmX2lkIjoiNjczOTZkMzI3MjgyMDZlZmI5MmYxYzMwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2NTE4LCJleHAiOjE3ODIzOTI5MTh9.0QX9uQmDq0MHfOnnRYTKjK6kyGO9XJTHooaKxDuqgcM)

 (image/png)    


[image2024-5-24_14-13-36.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMzJhMWFkOWEzMzExZGM4ZjZhIiwicmVmX2lkIjoiNjczOTZkMzI3MjgyMDZlZmI5MmYxYzMwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2NTE4LCJleHAiOjE3ODIzOTI5MTh9.v_rhFArFqW0pg8lvMATzvEteVGjyyL6jaquok0-GoXU)

 (image/png)    


[image2024-5-24_14-10-3.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMzI4OTcwYzJhZjRmNTIxMGZiIiwicmVmX2lkIjoiNjczOTZkMzI3MjgyMDZlZmI5MmYxYzMwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2NTE4LCJleHAiOjE3ODIzOTI5MTh9.GPfhjIUTKkwbRlfgjUPQ-uoPGKPCqHQu7ikwWgMuMLg)

 (image/png)    


[image2024-5-24_14-6-20.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMzI4OTcwYzJhZjRmNTIxMGZkIiwicmVmX2lkIjoiNjczOTZkMzI3MjgyMDZlZmI5MmYxYzMwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2NTE4LCJleHAiOjE3ODIzOTI5MTh9.y07rU6RsM54E3Kd1igQFG1EIaDYa8oPskPp9MMOnuWA)

 (image/png)    


[image2024-5-23_16-27-10.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMzJhMWFkOWEzMzExZGM4ZjZkIiwicmVmX2lkIjoiNjczOTZkMzI3MjgyMDZlZmI5MmYxYzMwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2NTE4LCJleHAiOjE3ODIzOTI5MTh9.Yk8q37aeYeZI9nWXczL3WDp340scdYVghBZm8S2vH6A)

 (image/png)    


## Comments:

|  [](null)  ,1、导出文件名 多次导出会覆盖 – 新增参数指定文件名 ,2、    [CTE - 许秋莹 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/display/~xuqiuying/CTE)    、注释等 校验，从directExecute 改为 prepare 取出属性,3、属性转成lob后，导出 –  以最终类型处理 ,Posted by chengkang at 五月 29, 2024 14:38|
|---|
