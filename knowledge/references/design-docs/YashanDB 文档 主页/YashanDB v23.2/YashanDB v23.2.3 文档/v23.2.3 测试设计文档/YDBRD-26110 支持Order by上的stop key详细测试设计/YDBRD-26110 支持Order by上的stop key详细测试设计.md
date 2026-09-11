Created by 刘清萍, last modified on 六月 03, 2024

# 1. 概述

sr链接：    [https://pingcode.yasdb.com/pjm/items/6618a72dfd997db58ad7de53](https://pingcode.yasdb.com/pjm/items/6618a72dfd997db58ad7de53)    ?    
  #YDBRD-26110 支持Order by上的stop key

*需求来源：*  *南方电网POC*

*功能概述：*  *支持order by stop key算子*

*需求范围：单机*

  [https://pingcode.yasdb.com/pjm/items/6618a72dfd997db58ad7de53](https://pingcode.yasdb.com/pjm/items/6618a72dfd997db58ad7de53)    *?*  *  
*  *#YDBRD-26110 支持Order by上的stop key*

# 2. 需求分析

## 2.1 功能点分析

 

**使用场景**  ：一般来说，Stop Key 算子主要用于在有序索引上执行的查询。当查询涉及到有序索引时，数据库引擎可以利用 Stop Key 算子来优化查询执行过程，从而提高性能。

虽然 Stop Key 算子通常与有序索引相关联，但并不是说只有在列上有索引时才会使用。如果查询涉及到有序数据，但没有明确的索引支持，数据库仍然可以使用临时的排序操作来实现 Stop Key 的效果，尽可能减少扫描的数据量。

总的来说，索引可以加速查询，并且在使用 Stop Key 算子时通常是更高效的，但并不是唯一的使用场景。数据库系统会根据具体情况灵活选择最合适的优化方式来执行查询。

## 2.2 应用场景

- *单机行列-----需求范围*
- *分布式（也支持limit）*


![](https://pingcode.yasdb.com/atlas/files/public/67396cfba1ad9a3311dc8df6/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFCQUFBQUFDQUlBQUFBQUFBQUFnQUFBQVFBQUFJQUFBQUFnQUFFQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFCQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQWdBQUFBQUFnQUFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDUxMzMsImV4cCI6MTc4MjMxNTkzM30.52IX84mTDT6jPuUq2N-Ca6FsrxspRAC8_Pj3_MYZtx4)

![](https://pingcode.yasdb.com/atlas/files/public/67396cfb8970c2af4f520f85/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFCQUFBQUFDQUlBQUFBQUFBQUFnQUFBQVFBQUFJQUFBQUFnQUFFQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFCQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQWdBQUFBQUFnQUFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDUxMzMsImV4cCI6MTc4MjMxNTkzM30.52IX84mTDT6jPuUq2N-Ca6FsrxspRAC8_Pj3_MYZtx4)

![](https://pingcode.yasdb.com/atlas/files/public/67396cfba1ad9a3311dc8df7/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFCQUFBQUFDQUlBQUFBQUFBQUFnQUFBQVFBQUFJQUFBQUFnQUFFQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFCQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQWdBQUFBQUFnQUFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDUxMzMsImV4cCI6MTc4MjMxNTkzM30.52IX84mTDT6jPuUq2N-Ca6FsrxspRAC8_Pj3_MYZtx4)

![](https://pingcode.yasdb.com/atlas/files/public/67396cfb8970c2af4f520f86/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFCQUFBQUFDQUlBQUFBQUFBQUFnQUFBQVFBQUFJQUFBQUFnQUFFQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFCQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQWdBQUFBQUFnQUFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDUxMzMsImV4cCI6MTc4MjMxNTkzM30.52IX84mTDT6jPuUq2N-Ca6FsrxspRAC8_Pj3_MYZtx4)

# 3. 详细测试设计

## 3.1 测试设计方法

1.对于走到stopkey等场景采取场景  覆盖法进行用例设计

2.对于无效等价类采取错误猜测法进行用例设计

3.对比结果和oracle执行结果是否一致

1. ## 3.2 详细测试设计
    1. *使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式*
    1. *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方*  *式*
1. # 4. 测试用例
    1. 测试设计评审时提供冒烟文本用例；
    1. 启动测试之前提供文本用例，并完成大部分自动化用例；
1. 
1. # 5. 测试框架设计
1.     - *如果用例不能实现自动化需要在此标注并说明原因*
    - *确认使用的测试框架及其满足度*

1. # 6. 测试环境说明
1. *测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*
1. *机器ip：192.168.18.108*
1. *操作系统：x86系统*
1. # 7. 工作量评估
1. 工作量：2人周
1. 计划测试完成时间：
1.   

1. 测试设计评审纪要    
    
  与会人：    
    
  评审时间：    
    
  评审地点：腾讯会议    
  会议主题：    
    
  评审纪要信息：
1.        
1.   
  评审通过与否：通过
1.   



|系统级DFX分类|是否涉及|
|:---|:---|
|CT|是|
|KT|否|
|长稳|否|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|否|
|安全|否|
|DFR|否|
|HA|否|
|压力|否|
|性能|是-------场景验证|
|可维护性|否|


|输入条件|有效等价类|备注|无效等价类|备注|
|:---|:---|:---|:---|:---|
|索引列|orderby|  
|  
|  
|
|能走到order by stopkey情况|view里面（子孙）有order by，外层有limit或者rownum|  
|view（儿子）中无orderby|  
|
|  
|父子都有orderby，父子排序键一致------确认oracle场景（顺序完全一致）|  
|父子都有orderby 排序键不一致|  
|
|  
|  
|  
|view儿子有limit，不下传|  
|
|  
|  
|  
|  
|  
|
|算子显示（   SORT GROUP stopkey）|group by + order by +limit/rownum|  
|order by中出现desc|  
|
|  
|  
|  
|order by中出现null first|  
|
|算子显示（SORT DISTINCT stopkey）|distinct + order by +limit/rownum|  
|  
|  
|
|  
|  
|  
|  
|  
|
|limit|limit单独使用|  
|两个limit不走stopkey|  
|
|  
|offset单独使用|  
|  
|  
|
|  
|limit offset组合使用|  
|  
|  
|
|  
|？？？绑定参数类型|  
|  
|  
|
|  
|组合fetch 3 rows first语法|  
|  
|  
|
|  
|limit和rownum组合|  
|  
|  
|
|rownum|<const、<=const |const试一下正数、负数|>,>=const|  
|
|  
|=1|  
|列名|  
|
|  
|<？,<=?  绑定参数-----------检查入参类型|  
|子查询----关联子查询、标量|  
|
|limit|expr>0|  
|expr<0|  
|
|  
|？？？绑定参数类型|  
|负数|  
|
|  
|多个limiit，父子都有limit|  
|  
|  
|
|order by语法|列名|  
|  
|  
|
|  
|const---位置|  
|  
|  
|
|  
|子查询|  
|  
|  
|
|  
|表达式|  
|  
|  
|
|  
|null last、null first|  
|  
|  
|
|  
|rownum|  
|  
|  
|
|rownum来源|from子查询中有rownum列 然后对此列和常量进行比较|  
|  
|  
|
|  
|子查询中有rownum列   join on、where on------join有表（inner）----------查看oracle表现|  
|  
|  
|
|  
|  
|  
|  
|  
|
|作为整体嵌套子查询|in、 exist|  
|  
|  
|
|  
|any 、all、 some|  
|  
|  
|
|  
|having|  
|  
|  
|
|  
|select后面跟子查询|  
|  
|  
|
|  
|cte |  
|  
|  
|
|  
|insert delete update|  
|  
|  
|
|  
|多层嵌套遍历|  
|  
|  
|


## Attachments: