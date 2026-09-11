Created by 李坤宇, last modified by  周湘淞 on 八月 30, 2023

#   [分布式TAC支持索引方案设计](#分布式tac支持索引方案设计)  

  [YDBRD-5228](https://jira.yasdb.com/browse/YDBRD-5228?src=confmacro)    -  分布式TAC支持索引  完成

  


##   [1. Overview（概述）](#1-overview概述)  

本方案是为了支持生成分布式列表的索引扫描计划。

  


##   [2. Features（功能特性）](#2-features功能特性)  

对列表生成分布式索引计划。

  


##   [3. Interfaces（接口）](#3-interfaces接口)  

本方案将原先不走索引的分支放开，增加了支持索引的算子，为内部调用函数，无对外接口。

  


##   [4. Limitations（功能限制）](#4-limitations功能限制)  

支持分布式索引列表，和单机TAC表的索引规格一致。修改前分布式列存计划不支持index scan，修改后支持。

![](https://pingcode.yasdb.com/atlas/files/public/67396b228970c2af4f5201f5/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBV0FBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQ0FBQUFRQUFBQUFBQUFBQUVBQUFBQUVBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTExMTksImV4cCI6MTc4MjMwMTkxOX0.HHeSsVuMJjIbKA6o9uvsXTNXE_uF_qVhaUJpSRbm6pc)

1. 只支持filter_equal作为join条件时改写为index nestloop。对应的也就是in或者= any子查询，能改写为semi join的场景。> any all some都走不了索引。
1. 分布式只支持  分布式只支持join条件为equal时，或者右表没有px算子、不进行分发时走索引。
1. 分布式中，是否走索引通过scan层上是否有filter作为判断依据，scan层上无filter，不走索引是正常的。
1. 分布式目前未实现N2N的sort merge，下层的有序性利用不上，order by语句不走索引是正常的。


  


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

直接在索引评估判断时，将原来为分布式和有列表时时就不做索引扫描的限制去掉：

![](https://pingcode.yasdb.com/atlas/files/public/67396b228970c2af4f5201f6/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBV0FBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQ0FBQUFRQUFBQUFBQUFBQUVBQUFBQUVBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTExMTksImV4cCI6MTc4MjMwMTkxOX0.HHeSsVuMJjIbKA6o9uvsXTNXE_uF_qVhaUJpSRbm6pc)

增加了判断是否有分布式enforcer存在的判断函数和索引相关的函数：

![](https://pingcode.yasdb.com/atlas/files/public/67396b22a1ad9a3311dc806e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBV0FBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQ0FBQUFRQUFBQUFBQUFBQUVBQUFBQUVBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTExMTksImV4cCI6MTc4MjMwMTkxOX0.HHeSsVuMJjIbKA6o9uvsXTNXE_uF_qVhaUJpSRbm6pc)

  


##   [6. Testcases（自测用例）](#6-testcases自测用例)  

与单机TAC索引规格一致，可参考    [单机TAC索引测试总结](https://conf.yasdb.com/pages/viewpage.action?pageId=72779101)  

  [  
](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#7%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

##   [7.资料设计章节](#7资料设计章节)  

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

## Attachments:

[image2023-8-1_16-59-40.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMjJhMWFkOWEzMzExZGM4MDY5IiwicmVmX2lkIjoiNjczOTZiMjE1OTNmOTljOWZmMjM1ZTYyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkxMTE5LCJleHAiOjE3ODIzNzc1MTl9.eoyrJfNG7Vv3qnEAJEBdOsw346NLUV0mQa-Z2UE394U)

 (image/png)    
