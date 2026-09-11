Created by 李攀, last modified on 七月 08, 2024

##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=153021088#1-%E6%80%BB%E8%BF%B0)  

在行存引擎跑批生成报表的场景，数据量大，表达式计算复杂，YashanDB和Oracle在SQL引擎的计算效率上的差距非常明显，性能通常落后2到10倍之间，客户对性能提升述求明确。 通过对聚集函数场景指令分布分析，SQL引擎和存储引擎指令数量各占比50%，即使没有SQL引擎，YashanDB仍然与Oracle有性能差距。因此优化执行代码无法解决成倍的性能差距。

*IR链接：*  ：    [https://pingcode.yasdb.com/ship/ideas/6614fdeb009f91eb87f32fa5](https://pingcode.yasdb.com/ship/ideas/6614fdeb009f91eb87f32fa5)    ?#YASHAN-2819 GroupBy性能优化

*SR链接：*  ：    [https://pingcode.yasdb.com/pjm/items/6618ea42fd997db58ad833d7](https://pingcode.yasdb.com/pjm/items/6618ea42fd997db58ad833d7)    ?#YDBRD-26181 GroupBy性能优化

开发设计文档：    [YDBRD-26174 批量执行表扫描性能优化设计文档](https://conf.yasdb.com/pages/viewpage.action?pageId=150628207)  

# 2. 需求分析

## 2.1 功能点分析

在行存批量全表扫描的基础上，实现  Hash GroupBy  的批量执行。整体目标：

                           Hash GroupBy的性能要明显优于单行执行。

## 2.2 应用场景

- ***单机行存***


![](https://pingcode.yasdb.com/atlas/files/public/67396e55a1ad9a3311dc96cf/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFJQUFBQUFBQUFBQkFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUJRSUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFTQUFBQUFBQUFBQWdBQUFBQUJBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzEzMzQsImV4cCI6MTc4MjM4MjEzNH0.twbY9Bpu9Y-bKmkSGI31ZIU_NyjJdlsFEhXoR56f7lY)

  


  


含有不支持的算子买入order by

![](https://pingcode.yasdb.com/atlas/files/public/67396e558970c2af4f52185c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFJQUFBQUFBQUFBQkFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUJRSUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFTQUFBQUFBQUFBQWdBQUFBQUJBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzEzMzQsImV4cCI6MTc4MjM4MjEzNH0.twbY9Bpu9Y-bKmkSGI31ZIU_NyjJdlsFEhXoR56f7lY)

***对比并行度---------------执行方式是否和批量执行方式相同***

  


# 3. 详细测试设计

## 3.1 测试设计方法

主要采取场景构造法，等价类划分法设计测试用例 查看计划和结果是否正确

## 3.2 详细测试设计

1. *使用章节3.1的测试方法设计详细的功能测试点，*
1. *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点*


|系统级DFX分类|是否涉及|
|:---|:---|
|CT|是，开启batch后，查询语句并发执行|
|KT|否|
|长稳|是|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|否|
|安全|否|
|DFR|否|
|HA|否|
|压力|否|
|性能------对比master----赵育的工程--------jdbc|是|
|可维护性|  
|
|建立复制工程|  
|
|覆盖率-----开发|  
|


![](https://pingcode.yasdb.com/atlas/files/public/67396e558970c2af4f52185d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFJQUFBQUFBQUFBQkFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUJRSUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFTQUFBQUFBQUFBQWdBQUFBQUJBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzEzMzQsImV4cCI6MTc4MjM4MjEzNH0.twbY9Bpu9Y-bKmkSGI31ZIU_NyjJdlsFEhXoR56f7lY)

|输入条件1|输入条件2|有效等价类|备注|无效等价类|备注|
|---|:---|:---|:---|:---|:---|
|资源受限情况表现|设置较小的PQ_POOL_SIZE, 和vm的值，批量执行开启最大，distinct数据量较大,  
|  
|查看表现，是否会报错vm  ，内存不足等|  
|  
|
|统计数据准确度|  
|统计数据不准确，采样率比较低的情况可能distinct值偏差较大|  
|  
|  
|
|  
|  
|未收集统计信息|  
|  
|  
|
|  
|  
|统计数据准确，偏离值较小|  
|  
|  
|
|  
|group by后的数据很大|  
|可能会报错内存不足|  
|  
|
|  
|不支持的情况|grouping sets，cube，rollup,含有order by,含有limit等|  
|  
|  
|
|group by字段+数据类型|单个字段单个聚集，覆盖所有数据类型和聚集函数|  
|  
|  
|  
|
|  
|group by多个字段和多个聚集，覆盖所有数据类型和聚集函数。|  
|  
|  
|  
|
|  
|group by列数量128列|  
|  
|  
|  
|
|  
|group by列 是表达式（c1+1）|  
|  
|  
|  
|
|select 投影列|聚集函数带distinct。,聚集函数不带distinct ,没有聚集函数,  
|  
|  
|窗口函数不支持,投影列含有 distinct  不带聚集|  
|
||filter|< 、<=、 >、>=、=、!=,in/not in list,in/not in subquery,and\or,case when|  
|  
|  
|
|数据分布|数据包含NULL值，nulll值较多|  
|  
|  
|  
|
|  
|数据不含nulll值|  
|  
|  
|  
|
|  
|hashtable数据中distinc值比较大,  
|4194304/2=2,097,152,>2,097,152,  
|>2,097,152会报错,  
|  
|  
|
|  
|大数据量|  
|  
|  
|  
|
|边界值情况|空表|  
|  
|  
|  
|
|  
|只有1行数据的表|  
|  
|  
|  
|
|  
|行数100000，但是分组列的distinct值为1|  
|  
|  
|  
|
|参数设置|batch size的大小测试|1,10,100,200,256,对比不同 的batch size大小执行效率|  
|  
|  
|
|表类型|分区表|  
|不支持，不走批量|  
|  
|
|  
|临时表|  
|  
|  
|  
|
|索引，hahs group 列为索引列|限制|  
|  
|  
|  
|
|having|主要放聚集函数,子查询|  
|  
|  
|  
|
|where 条件|复杂表达式|  
|  
|  
|  
|
||< 、<=、 >、>=、=、!=,in/not in list,in/not in subquery,and\or,case when|  
|  
|  
|  
|
|和聚集函数-------batchsize|min|  
|  
|  
|  
|
|  
|max|  
|  
|  
|  
|
|  
|sum|  
|  
|  
|  
|
|  
|count|  
|  
|  
|  
|
|  
|avg可以改写成sum、count也可以做|  
|  
|  
|  
|
|join，hash join|join 表数量|2,3，,128|  
|  
|  
|
||join的表含有大表，10000万数据以上|  
|  
|  
|  
|
|  
|  
|  
|  
|  
|  
|
|绑定参数|绑定参数可以放置位置|having filter,where filter,  
|  
|  
|  
|
|伪列|rownum|  
|  
|  
|  
|
|  
|rowid|  
|  
|  
|  
|
|  
|connect by----应该也是不支持,  
|  
|  
|  
|  
|
|子查询|having 子查询,from  子查询,where 子查询,投影列子查询,在查询里面是否生效|  
|  
|  
|  
|
|覆盖数据类型？？？？|数据类型转换   id+id |  
|  
|  
|  
|
|在PLSQL中|  
|  
|  
|  
|  
|
|cte里面 |  
|预期不支持|  
|  
|  
|
|alter session set _BATCH_ENABLED=ON;|关掉后在执行--还是走batch---sql记忆|  
|  
|  
|  
|


alter session set _BATCH_ENABLED=ON;    
  alter session set _BATCH_SIZE=64;

# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


文本用例：

[group by批量执行文本用例 .xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNTVhMWFkOWEzMzExZGM5NmNhIiwicmVmX2lkIjoiNjczOTZlNTQ1OTNmOTljOWZmMjM4M2NjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxMzM0LCJleHAiOjE3ODI0NTc3MzR9.ZE17-0UrD8YAgaSfXT4Sv3x7Boxcz7mBbAOVfTXyC-4)

# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*
- *使用c/oci对应git仓库里的CUNIT框架，c驱动已使用HA部署*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

*机器ip：192.168.18.108*

*操作系统：x86系统*

# 7. 工作量评估

工作量：

计划测试完成时间：

  


测试设计评审纪要    
    
  与会人：李攀，陈楚坤，唐嘉欣，马文英，罗继鸿，刘清萍    
    
  评审时间：2024.6.19 16：00    
    
  评审地点：线上腾讯会议    
    
  评审纪要信息：数据类型支持情况

                         子查询不支持

                         hash join不支持

      

  
  评审通过与否：通过

  


## Attachments:

[image2024-6-18_14-35-35.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNTU4OTcwYzJhZjRmNTIxODU4IiwicmVmX2lkIjoiNjczOTZlNTQ1OTNmOTljOWZmMjM4M2NjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxMzM0LCJleHAiOjE3ODI0NTc3MzR9.WKy3CrvRF9TYUx09l2MM8rNpSvQep8xthK1CMufjb-M)

 (image/png)    


[image2024-6-18_14-36-6.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNTU4OTcwYzJhZjRmNTIxODU5IiwicmVmX2lkIjoiNjczOTZlNTQ1OTNmOTljOWZmMjM4M2NjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxMzM0LCJleHAiOjE3ODI0NTc3MzR9.qWP9wNJk-u54kY1nwjf3ZLM7qn-YJXSMbCPgfpwbMuQ)

 (image/png)    


[image2024-6-18_14-41-20.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNTU4OTcwYzJhZjRmNTIxODVhIiwicmVmX2lkIjoiNjczOTZlNTQ1OTNmOTljOWZmMjM4M2NjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxMzM0LCJleHAiOjE3ODI0NTc3MzR9.VTq4XtWr5LuEEvAF-ndZkPsevoZV0T1oJXjm21COYsY)

 (image/png)    


[image2024-6-18_14-57-5.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNTVhMWFkOWEzMzExZGM5NmNiIiwicmVmX2lkIjoiNjczOTZlNTQ1OTNmOTljOWZmMjM4M2NjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxMzM0LCJleHAiOjE3ODI0NTc3MzR9.q49wjyJFekGfbaC9ywin-49q-HAc_8DZ4BOMpF0GH44)

 (image/png)    


[image2024-6-18_11-21-41.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNTVhMWFkOWEzMzExZGM5NmNjIiwicmVmX2lkIjoiNjczOTZlNTQ1OTNmOTljOWZmMjM4M2NjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxMzM0LCJleHAiOjE3ODI0NTc3MzR9._F03SRuKYwK-s36utH464lLHOp34FFKor9FShIxCzsA)

 (image/png)    


[group by批量执行文本用例 .xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNTVhMWFkOWEzMzExZGM5NmNhIiwicmVmX2lkIjoiNjczOTZlNTQ1OTNmOTljOWZmMjM4M2NjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxMzM0LCJleHAiOjE3ODI0NTc3MzR9.ZE17-0UrD8YAgaSfXT4Sv3x7Boxcz7mBbAOVfTXyC-4)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
