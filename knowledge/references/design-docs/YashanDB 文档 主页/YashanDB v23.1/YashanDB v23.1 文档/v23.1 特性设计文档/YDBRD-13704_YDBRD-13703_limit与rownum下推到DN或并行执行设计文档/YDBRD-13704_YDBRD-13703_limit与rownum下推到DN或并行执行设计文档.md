Created by 陈芊宇 on 七月 10, 2023

#   [YDBRD-13704/YDBRD-13703 : Pushdown Limit and Rownum Design（limit与rownum下推方案设计）](#ydbrd-13704ydbrd-13703--pushdown-limit-and-rownum-designlimit与rownum下推方案设计)  

SR链接：

  [https://jira.yasdb.com/browse/YDBRD-13704](https://jira.yasdb.com/browse/YDBRD-13704)  

  [https://jira.yasdb.com/browse/YDBRD-13703](https://jira.yasdb.com/browse/YDBRD-13703)  

##   [1. Overview（概述）](#1-overview概述)  

将rownum和limit offset下推至并行的PX之下或者分布式的DN上执行。

|算子形式|支持部署形式|
|---|---|
|count本层仅在有rownum|列存并行、分布式(当前分布式不支持count)|
|count下层含有rownum|不下推|
|limit|列存并行、分布式|
|limit offset|列存并行、分布式|
|top sort|列存并行、分布式|
|limit [offset] + count|列存并行、分布式|


##   [2. Features（功能特性）](#2-features功能特性)  

将limit offset、top sort、count stopkey下推到并行之下或者分布式的DN节点上。

##   [3. Interfaces（接口）](#3-interfaces接口)  

直接使用SQL语句。

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

limit [offset] + count情况下，下推count(count需要满足第一条和第二条的要求)

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 count算子](#51-count算子)  

count算子下推规则：

1. count stopkey会被下推；
1. count不会被下推；


###   [5.2 window算子](#52-window算子)  

window算子下推规则：

1. limit n 会被下推，n>=1；
1. limit n offset m 会下推limit n+max(m, 0)，n>=1；
1. limit n [offset m]当n<1时，会增加result，其上挂filter(false)（并行与非并行都做）；
1. limit n [offset m] + count 会下推count，遵循的count下推规则。


m, n满足limit offset规格。

打印window信息。

###   [5.3 对参数的处理](#53-对参数的处理)  

####   [5.3.1 rownum](#531-rownum)  

对于rownum，rownum cmp param这种情况本身挂在result上，所以本方案不涉及rownum cmp param下推。

####   [5.3.2 window](#532-window)  

分情况讨论：

1. limit param [offset n]


下推为limit TO_NUMBER(param)[+n]

1. limit n offset param


下推为limit n+GREATEST(FLOOR(TO_NUMBER(param)),0)

1. limit param1 offset param2


下推为limit TO_NUMBER(param1)+GREATEST(FLOOR(TO_NUMBER(param2)),0)

这与oracle有一定的区别，oracle增加出的是TO_NUMBER(GREATEST(TO_CHAR(FLOOR(TO_NUMBER(:1))),'0'))

###   [5.4 路径增加](#54-路径增加)  

增加下推的路径与不下推的路径。

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

注意事项：

1. 仔细阅读rownum设计文档；
1. 结果集不稳定问题；
1. 在优化器中加入路径，但该路径不一定被选到；
1. 部分用例见附件。


##   [7.资料设计章节](#7资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

top sort当前并非最优计划，最优计划是上层使用merge，而非两个top sort。

limit和offset中含有param，依旧不下退，需要执行支持，目前状态是封掉。计划已经完成：    [https://git.yasdb.com/chenqianyu/anchorbase/-/commits/dev_pushdown_limitoffset](https://git.yasdb.com/chenqianyu/anchorbase/-/commits/dev_pushdown_limitoffset)  

oracle支持limit 1+?这种写法，我们的limit和offset后面只能使用单独的param，不能对param进行计算。比如下图：

![](https://pingcode.yasdb.com/atlas/files/public/67396ae7a1ad9a3311dc7e4f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyODk5ODksImV4cCI6MTc4MjMwMDc4OX0.OpuZmA9pno2C-o8Bgj63eGRJXaWyboGCPlqgEYGsCSs)

  


  


## Attachments:

[oracle.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZTc4OTcwYzJhZjRmNTFmZmQ1IiwicmVmX2lkIjoiNjczOTZhZTc3MjgyMDZlZmI5MmVmZjQ3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjg5OTg5LCJleHAiOjE3ODIzNzYzODl9.x7Kxbu1ZsjNYqij1BO1Sg2RkIkWWYR7TGU2PEOnbJW8)

 (application/octet-stream)    


[image2023-6-8_14-23-32.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZTdhMWFkOWEzMzExZGM3ZTRlIiwicmVmX2lkIjoiNjczOTZhZTc3MjgyMDZlZmI5MmVmZjQ3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjg5OTg5LCJleHAiOjE3ODIzNzYzODl9.HHbGQS3Vne7-dhLkxbBqlTBtAEcK7IwhH_pHv40lX_o)

 (image/png)    


[oracle.out](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZTc4OTcwYzJhZjRmNTFmZmQ2IiwicmVmX2lkIjoiNjczOTZhZTc3MjgyMDZlZmI5MmVmZjQ3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjg5OTg5LCJleHAiOjE3ODIzNzYzODl9.H-9QznlYLed70S9NDbqvqFWYYeAh5g9InMeur7oD3jc)

 (application/octet-stream)    


[image2023-6-7_11-9-41.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZTc4OTcwYzJhZjRmNTFmZmQ3IiwicmVmX2lkIjoiNjczOTZhZTc3MjgyMDZlZmI5MmVmZjQ3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjg5OTg5LCJleHAiOjE3ODIzNzYzODl9.d4ILDkyAFco3bFTPhviXhRuspzvkWN99DJgaho62q8E)

 (image/png)    


[屏幕截图 2023-06-05 164345.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZTc4OTcwYzJhZjRmNTFmZmQ4IiwicmVmX2lkIjoiNjczOTZhZTc3MjgyMDZlZmI5MmVmZjQ3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjg5OTg5LCJleHAiOjE3ODIzNzYzODl9.mefwjX0z_484I1ZtWqZhP4dJeqO7h-FX39HiHasZsTA)

 (image/png)    
