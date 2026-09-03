Created by 张锐, last modified on 四月 07, 2024

#   [Yashan DB 外键支持默认reference](#yashan-db-外键支持默认reference)  

SR:     [https://jira.yasdb.com/browse/YDBRD-28443](https://jira.yasdb.com/browse/YDBRD-28443)  

##   [1. Overview（概述）](#1-overview概述)  

Yashan DB在创建外键时，如果不指定父表的列，则默认关联父表主键。

##   [2. Features（功能特性）](#2-features功能特性)  

在创建外键时，如果不指定父表的列，则默认关联父表主键。如果父表不存在主键或者主键与外键不匹配，则创建失败。

##   [3. Interfaces（接口）](#3-interfaces接口)  

![](https://pingcode.yasdb.com/atlas/files/public/67396cd18970c2af4f520e86/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDM2MTAsImV4cCI6MTc4MjMxNDQxMH0.aw678yUesuUo6RJ7vuuGTVI6N5j_tVouYykgIZJkwKc)

##   [4. Limitations（功能限制）](#4-limitations功能限制)  

- 如果父表主键不存在或者主键与外键定义不匹配，则创建失败


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

解析时，如果references后面表名没有跟随列明列表，则跳过。创建时默认找对应父表主键。

###   [注意：](#注意)  

如果父表主键不存在或者主键与外键定义不匹配，则创建失败

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

测试用例详情见mr：    [https://git.yasdb.com/cod-x/anchorbase/-/merge_requests/33133](https://git.yasdb.com/cod-x/anchorbase/-/merge_requests/33133)  

##   [7. Workload（工作量）](#7-workload工作量)  

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

## Attachments:

[image2022-10-17_15-42-3.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZDE4OTcwYzJhZjRmNTIwZTg1IiwicmVmX2lkIjoiNjczOTZjZDE3MjgyMDZlZmI5MmYxNmU5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzNjEwLCJleHAiOjE3ODIzOTAwMTB9.Tuk67Fbp7UipoeOytZD2z4uqOE5J8SPrHrDT6cKOM28)

 (image/png)    
