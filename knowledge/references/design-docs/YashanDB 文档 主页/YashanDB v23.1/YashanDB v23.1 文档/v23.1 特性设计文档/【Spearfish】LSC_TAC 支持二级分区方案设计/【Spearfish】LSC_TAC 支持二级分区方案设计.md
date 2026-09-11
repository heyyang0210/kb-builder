Created by 陈宜顺, last modified by  未知用户 (public1) on 六月 07, 2023

  [YDBRD-13506](https://jira.yasdb.com/browse/YDBRD-13506?src=confmacro)    -  LSC表支持二级分区  完成

##   [1. Overview（概述）](#1-overview概述)  

在原有的分区框架之上，适配LSC支持二级分区的相关操作。

##   [2. Features（功能特性）](#2-features功能特性)  

1.LSC/TAC支持 hash-hash, hash-list, hash-range, range-hash, range-list, range-range, list-hash, list-range, list-list 9种组合分区表的create/drop table。    
  2.LSC/TAC支持 hash-hash, hash-list, hash-range, range-hash, range-list, range-range, list-hash, list-range, list-list 9种组合分区表的truncate/add/drop partition/subpartition 。    
  3.LSC/TAC支持 hash-hash, hash-list, hash-range, range-hash, range-list, range-range, list-hash, list-range, list-list 9种组合分区表数据进行insert/delete/update/select操作。    
  4.lockTableSliceDirectly支持二级分区。    
  5.bulkload导入支持二级分区。    
  6.支持二级分区表空间offline/online。    
  7.支持MMS表空间。

##   [3. Interfaces（接口）](#3-interfaces接口)  

无新增接口。

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

1.add subpartition限制见：    [https://conf.yasdb.com/display/YAS/Add+Subpartition](https://conf.yasdb.com/display/YAS/Add+Subpartition)      
  2.drop subpartition限制见：    [https://conf.yasdb.com/display/YAS/Drop+Subpartition](https://conf.yasdb.com/display/YAS/Drop+Subpartition)      
  3.create/drop/truncate 限制见：    [https://conf.yasdb.com/pages/viewpage.action?pageId=107385745](https://conf.yasdb.com/pages/viewpage.action?pageId=107385745)      
  4.二级分区lsc表不支持建AC。

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 Architecture（架构）](#51-architecture架构)  

###   [5.2 Data Structures & Flow（数据结构与流程）](#52-data-structures--flow数据结构与流程)  

create table流程：

![](https://pingcode.yasdb.com/atlas/files/public/67396af68970c2af4f520041/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUN3Q0FRQUFBQkFBQUFFQUFBQUFBQUFBQUNBQUFBRUFBZ0FBQUFBSUFBQUFBRUFBQUFJQUNBQUFBQUFBUUFBQUFFQUFBZ0FBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQWdBQUFBQUFBQUFBQkFBQVFBQUFBQUFBQUFJQUFBQUFBQWdBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTAzOTYsImV4cCI6MTc4MjMwMTE5Nn0.skenY9XbbFe6Wi3qBeSQoNG5memnd1DJzcibkUM7fl4)

drop table流程：

![](https://pingcode.yasdb.com/atlas/files/public/67396af6a1ad9a3311dc7eb9/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUN3Q0FRQUFBQkFBQUFFQUFBQUFBQUFBQUNBQUFBRUFBZ0FBQUFBSUFBQUFBRUFBQUFJQUNBQUFBQUFBUUFBQUFFQUFBZ0FBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQWdBQUFBQUFBQUFBQkFBQVFBQUFBQUFBQUFJQUFBQUFBQWdBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTAzOTYsImV4cCI6MTc4MjMwMTE5Nn0.skenY9XbbFe6Wi3qBeSQoNG5memnd1DJzcibkUM7fl4)

add partition流程

![](https://pingcode.yasdb.com/atlas/files/public/67396af6a1ad9a3311dc7eba/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUN3Q0FRQUFBQkFBQUFFQUFBQUFBQUFBQUNBQUFBRUFBZ0FBQUFBSUFBQUFBRUFBQUFJQUNBQUFBQUFBUUFBQUFFQUFBZ0FBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQWdBQUFBQUFBQUFBQkFBQVFBQUFBQUFBQUFJQUFBQUFBQWdBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTAzOTYsImV4cCI6MTc4MjMwMTE5Nn0.skenY9XbbFe6Wi3qBeSQoNG5memnd1DJzcibkUM7fl4)

drop partition流程

![](https://pingcode.yasdb.com/atlas/files/public/67396af68970c2af4f520042/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUN3Q0FRQUFBQkFBQUFFQUFBQUFBQUFBQUNBQUFBRUFBZ0FBQUFBSUFBQUFBRUFBQUFJQUNBQUFBQUFBUUFBQUFFQUFBZ0FBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQWdBQUFBQUFBQUFBQkFBQVFBQUFBQUFBQUFJQUFBQUFBQWdBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTAzOTYsImV4cCI6MTc4MjMwMTE5Nn0.skenY9XbbFe6Wi3qBeSQoNG5memnd1DJzcibkUM7fl4)

insert data流程：

![](https://pingcode.yasdb.com/atlas/files/public/67396af6a1ad9a3311dc7ebb/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUN3Q0FRQUFBQkFBQUFFQUFBQUFBQUFBQUNBQUFBRUFBZ0FBQUFBSUFBQUFBRUFBQUFJQUNBQUFBQUFBUUFBQUFFQUFBZ0FBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQWdBQUFBQUFBQUFBQkFBQVFBQUFBQUFBQUFJQUFBQUFBQWdBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTAzOTYsImV4cCI6MTc4MjMwMTE5Nn0.skenY9XbbFe6Wi3qBeSQoNG5memnd1DJzcibkUM7fl4)

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

  [https://git.yasdb.com/liziyi/anchorbase/-/commit/8da78fc03d9d7479238e02195555f31c5cc6847e](https://git.yasdb.com/liziyi/anchorbase/-/commit/8da78fc03d9d7479238e02195555f31c5cc6847e)  

自测关注点：

1. 遵守原有的组合分区DDL约束。    
  组合分区DDL：    [https://conf.yasdb.com/pages/viewpage.action?pageId=107385743](https://conf.yasdb.com/pages/viewpage.action?pageId=107385743)  
1. 操作结束检查系统表是否add/drop/truncate分区。    
  组合分区系统表：    [https://conf.yasdb.com/pages/viewpage.action?pageId=95096051](https://conf.yasdb.com/pages/viewpage.action?pageId=95096051)  
1. 遵守原有指定分区DML约束。    
  指定分区DML：    [https://conf.yasdb.com/pages/viewpage.action?pageId=59609429](https://conf.yasdb.com/pages/viewpage.action?pageId=59609429)  


##   [7.参考资料](#7参考资料)  

  [https://conf.yasdb.com/pages/viewpage.action?pageId=107385743](https://conf.yasdb.com/pages/viewpage.action?pageId=107385743)  

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

## Attachments:

[image2023-5-24_11-16-9.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZjVhMWFkOWEzMzExZGM3ZWFkIiwicmVmX2lkIjoiNjczOTZhZjU1OTNmOTljOWZmMjM1YmE4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwMzk2LCJleHAiOjE3ODIzNzY3OTZ9.hx-nEOSQHfkFDlvAx929gVGLlUQzP3o3nfsBYdW25Ug)

 (image/png)    


[image2023-5-24_20-11-43.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZjU4OTcwYzJhZjRmNTIwMDM4IiwicmVmX2lkIjoiNjczOTZhZjU1OTNmOTljOWZmMjM1YmE4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwMzk2LCJleHAiOjE3ODIzNzY3OTZ9.1u5DkFSB3kA-g_OGYNG3s-TZn6HlVCEfU7fcgoYEtdM)

 (image/png)    


[image2023-5-24_20-12-21.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZjY4OTcwYzJhZjRmNTIwMDM5IiwicmVmX2lkIjoiNjczOTZhZjU1OTNmOTljOWZmMjM1YmE4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwMzk2LCJleHAiOjE3ODIzNzY3OTZ9.A3m7LvkMFp5FYwrOfWVxmUZhyWrdbe_lPe4DHFLI-wY)

 (image/png)    


[image2023-5-24_20-14-5.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZjZhMWFkOWEzMzExZGM3ZWFmIiwicmVmX2lkIjoiNjczOTZhZjU1OTNmOTljOWZmMjM1YmE4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwMzk2LCJleHAiOjE3ODIzNzY3OTZ9.JCqNcpP5uEOSo1HB5r8lcqjBqUd76b7bvN8Cv9TGtDY)

 (image/png)    


[image2023-5-25_9-51-15.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZjY4OTcwYzJhZjRmNTIwMDNhIiwicmVmX2lkIjoiNjczOTZhZjU1OTNmOTljOWZmMjM1YmE4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwMzk2LCJleHAiOjE3ODIzNzY3OTZ9.Ptuydo1sBmCqtzU_dhH0TyxYp-lP1RTFTpFyqXLSPBI)

 (application/octet-stream)    


[image2023-5-25_14-44-55.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZjZhMWFkOWEzMzExZGM3ZWIyIiwicmVmX2lkIjoiNjczOTZhZjU1OTNmOTljOWZmMjM1YmE4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwMzk2LCJleHAiOjE3ODIzNzY3OTZ9.FCvGhXaLepebkLEpdMHkzfhpnrq3KFNZ0PCmHE2pDfE)

 (application/octet-stream)    


[image2023-5-25_21-59-17.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZjY4OTcwYzJhZjRmNTIwMDNiIiwicmVmX2lkIjoiNjczOTZhZjU1OTNmOTljOWZmMjM1YmE4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwMzk2LCJleHAiOjE3ODIzNzY3OTZ9.XxHkMLQkoITgB5s6_2G8tQTQHJmtwYzIbPOVidE_x9Q)

 (application/octet-stream)    


[image2023-5-29_9-19-59.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZjZhMWFkOWEzMzExZGM3ZWI2IiwicmVmX2lkIjoiNjczOTZhZjU1OTNmOTljOWZmMjM1YmE4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwMzk2LCJleHAiOjE3ODIzNzY3OTZ9.Nlis0LNh_zZ3qa4ic5NMBBVaLPYSaWdmQi1sWG-2WhU)

 (image/png)    


[image2023-5-29_11-18-6.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZjY4OTcwYzJhZjRmNTIwMDNmIiwicmVmX2lkIjoiNjczOTZhZjU1OTNmOTljOWZmMjM1YmE4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwMzk2LCJleHAiOjE3ODIzNzY3OTZ9.BdEiK59h3BGwhj0Ib9jLPb7LKBjyRnXsW8pMQOI0BIE)

 (image/png)    


[image2023-6-6_16-38-36.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZjZhMWFkOWEzMzExZGM3ZWI4IiwicmVmX2lkIjoiNjczOTZhZjU1OTNmOTljOWZmMjM1YmE4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwMzk2LCJleHAiOjE3ODIzNzY3OTZ9.83CV8fUxbOjOaHlz4KwNJ2ig194Tnf_Ss8r827Ybf2Y)

 (image/png)    


## Comments:

|  [](null)  ,LSC二级分区表不支持会产生row movement的update操作,-- 不支持跨分区更新，需要等冷数据删除的SR合入后支持。分布式下还依赖YDBRD-14078,导入支持：YDBRD-7757跟踪，包含服务端导入和客户端导入,  
,  
,Posted by chenyishun at 五月 24, 2023 16:09|
|---|
|  [](null)  ,补充考虑的点：,1. TAC也要支持二级分区，考虑TAC临时表，
1. 闪回、回收站暂不支持、测offline表空间、MMS表空间
,Posted by chenyishun at 五月 29, 2023 10:40|
