Created by 王博文, last modified on 十月 30, 2024

*IR链接：*    [YASHAN-3169](https://pingcode.yasdb.com/ship/ideas/66cc25ea4283cf23d4f3b3bc? #YASHAN-3169  【mysql兼容】支持ANY_VALUE、SLEEP和VALUES函数)  

*SR链接：*    [YDBRD-33978](https://pingcode.yasdb.com/pjm/items/670a4d22e489dd0868f64fb6? #YDBRD-33978 【mysql兼容】支持ANY_VALUE函数)  

##   [1. 总述](#1-总述)  

###   [1.1 需求来源](#11-需求来源)  

支持MySQL中ANY_VALUE函数。

###   [1.2 调研文档](#12-调研文档)  

###   [1.3 需求分析](#13-需求分析)  

###   [1.4 数据字典](#14-数据字典)  

###   [1.5 开源依赖](#15-开源依赖)  

##   [2. 接口](#2-接口)  

###   [2.1 SQL语法](#21-sql语法)  

```
select ANY_VALUE(arg);

```

###   [2.2 语句功能](#22-语句功能)  

来源：MySQL文档 -     [ANY_VALUE函数](https://dev.mysql.com/doc/refman/5.7/en/miscellaneous-functions.html#function_any-value)  

用于group by查询，返回值和arg同类型，MySQL5.7默认启用sql_mode：    [ONLY_FULL_GROUP_BY](https://dev.mysql.com/doc/refman/5.7/en/sql-mode.html#sqlmode_only_full_group_by)  

该模式中：select、having、order by指定的列，必须出现或依赖于group by子句中的列（可以由group by列唯一指定），否则查询报错。

故此时使用any_value，避免查询中因为无关列而报错。

###   [2.3 调研结论](#23-调研结论)  

##   [2.3.1 arg为列名](#231-arg为列名)  

- 示例中因为f2为非聚合列：既不在group by中，也不在功能上依赖group by的列。对f2使用any_value函数后可成功。
- 若查询中不含group by，直接返回该列。


![](https://pingcode.yasdb.com/atlas/files/public/67397ef18970c2af4f52468a/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBRUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBRUFBRUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUJBQUFBQkFBQUFDQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTUxMDAsImV4cCI6MTc4MjQ2NTkwMH0.6uxoBwkcEJ9oicsBL-kOLeCPoN2TUQOfqqAZGXhVBhM)

##   [2.3.2 arg不为列名](#232-arg不为列名)  

返回输入的arg，返回值数据类型与arg数据类型关系如下图。

![](https://pingcode.yasdb.com/atlas/files/public/67397ef1a1ad9a3311dcc4f9/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBRUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBRUFBRUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUJBQUFBQkFBQUFDQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTUxMDAsImV4cCI6MTc4MjQ2NTkwMH0.6uxoBwkcEJ9oicsBL-kOLeCPoN2TUQOfqqAZGXhVBhM)

##   [2.3.3 yasdb中报错场景](#233-yasdb中报错场景)  

yasdb中不存在同名函数，但存在类似报错场景。

若select列不为聚合函数，需与group by相关

![](https://pingcode.yasdb.com/atlas/files/public/67397ef1a1ad9a3311dcc4fa/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBRUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBRUFBRUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUJBQUFBQkFBQUFDQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTUxMDAsImV4cCI6MTc4MjQ2NTkwMH0.6uxoBwkcEJ9oicsBL-kOLeCPoN2TUQOfqqAZGXhVBhM)

##   [3. 规格与约束](#3-规格与约束)  

1. MySQL中该函数非聚合函数
1. arg为列名时，指定group by返回该group首行数据；不指定group by返回列数据，等价于未使用该函数
1. arg不为列名时，直接返回arg


##   [4. Dependency（功能依赖）](#4-dependency功能依赖)  

说明整个特性或子特性，在对应数据库下，调研得到的功能对第三方件的依赖，开源协议。

  


  


## Attachments:

[image2024-7-30_10-53-43.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTdlZjBhMWFkOWEzMzExZGNjNGY2IiwicmVmX2lkIjoiNjczOTdlZjA3MjgyMDZlZmI5MmY3YjY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU1MTAwLCJleHAiOjE3ODI1NDE1MDB9.xtTbXu8Bqz6VS70Nj1OWKP3HoGpbhm5esAcXrY92-VY)

 (image/png)    


[image2024-7-29_19-42-16.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTdlZjA4OTcwYzJhZjRmNTI0Njg1IiwicmVmX2lkIjoiNjczOTdlZjA3MjgyMDZlZmI5MmY3YjY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU1MTAwLCJleHAiOjE3ODI1NDE1MDB9.eNWQ9rblXpomA5c8Ns4ZQ8YwL5Zv6wRBAFldA-cOvY0)

 (image/png)    


[image2024-7-29_19-42-10.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTdlZjA4OTcwYzJhZjRmNTI0Njg2IiwicmVmX2lkIjoiNjczOTdlZjA3MjgyMDZlZmI5MmY3YjY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU1MTAwLCJleHAiOjE3ODI1NDE1MDB9.-FNUqkjqT2xFL3f-hZuhN0zYXBiIVJOjvL59WMAz2Xk)

 (image/png)    


[image2024-7-29_19-42-16.png.url](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTdlZjBhMWFkOWEzMzExZGNjNGY3IiwicmVmX2lkIjoiNjczOTdlZjA3MjgyMDZlZmI5MmY3YjY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU1MTAwLCJleHAiOjE3ODI1NDE1MDB9.GDjpH5rmscD0XCVXBkew361zP2r5UCsMJJHwlzJQEGQ)

 (application/octet-stream)    


[image2024-10-29_15-59-39.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTdlZjFhMWFkOWEzMzExZGNjNGY4IiwicmVmX2lkIjoiNjczOTdlZjA3MjgyMDZlZmI5MmY3YjY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU1MTAwLCJleHAiOjE3ODI1NDE1MDB9.N_mdFBGnQlz_CYC05wXB_TVlmavpw_nUxw3scjqtViE)

 (image/png)    
