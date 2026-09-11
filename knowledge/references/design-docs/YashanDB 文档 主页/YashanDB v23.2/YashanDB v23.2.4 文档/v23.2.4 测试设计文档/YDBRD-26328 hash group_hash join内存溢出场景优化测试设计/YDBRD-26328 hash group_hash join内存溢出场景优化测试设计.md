Created by 徐瑶, last modified on 八月 02, 2024

# 1. 概述

本文描述hash group/hash join内存溢出场景优化测试设计

## 1.1 相关文档

SR:          [https://pingcode.yasdb.com/pjm/items/661942e3fd997db58ad8c152](https://pingcode.yasdb.com/pjm/items/661942e3fd997db58ad8c152)    ?    
  #YDBRD-26328 hash group/hash join内存溢出场景的优化    


开发设计文档：    [hash算子内存溢出场景优化#columnar-vm-buffer-size%E4%BF%AE%E6%94%B9%E9%85%8D%E9%A2%9D%E5%8F%82%E6%95%B0%E5%AE%9E%E6%97%B6%E7%94%9F%E6%95%88](150605925.html#hash算子内存溢出场景优化-columnar-vm-buffer-size%E4%BF%AE%E6%94%B9%E9%85%8D%E9%A2%9D%E5%8F%82%E6%95%B0%E5%AE%9E%E6%97%B6%E7%94%9F%E6%95%88)  

调研文档：    [YASHAN-810_测试调研](https://conf.yasdb.com/pages/viewpage.action?pageId=153001047)  

# 2. 需求分析

## 2.1 功能点分析

1. COLUMNAR_VM_BUFFER_SIZE参数实时判断是否生效
1. Hash Group/Join算子增加判断，当内存充足时，申请新的配额，尽量加快计算


- 参数：
    - COLUMNAR_VM_BUFFER_SIZE：指定列存计算使用的内存大小。当列存计算中，排序，物化，join等涉及的数据量较多时，建议调大此参数，可以增加计算性能。默认值：   2G
    - COLUMNAR_MATERIAL_PERCENT：指定列存计算排序、物化、join等算子使用物化内存占COLUMNAR_VM_BUFFER_SIZE的百分比。默认值：80
    - COLUMNAR_MAX_OPERATOR_MEM_PERCENT：
    - ![](https://pingcode.yasdb.com/atlas/files/public/67396da58970c2af4f521459/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFRQUFBQUFBQUNBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTAzNTEsImV4cCI6MTc4MjMyMTE1MX0.X6tlXwHr-IuHTsEqLj2VXm1Jl6nmffhIfBi_kJyU7A4)
- 算子最大内存=  COLUMNAR_VM_BUFFER_SIZE * COLUMNAR_MATERIAL_PERCENT/100 * COLUMNAR_MAX_OPERATOR_MEM_PERCENT/100


    3.部署形态：单机、分布式列存

## 2.2 应用场景

- 大数据量hash join的性能，
- 大数据量hash group的性能
- 依据开发指定场景做相关测试


## 2.3 规格约束

- Hash Group的优化目前只针对没有聚合带distinct的场景
- 不保证能达到最佳性能（即不保证和一开始执行时内存充足的性能一致）
- Hash Join进入probe阶段以后，暂时无法加速
- join key重复值太多暂时无法优化


# 3. 详细测试设计

## 3.1 测试设计方法

本次测试设计主要采用场景法以及边界值方法验证

## 3.2 详细测试设计

1. *使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式*


|输入条件1|输入条件2|有效等价类|备注|无效等价类|备注|
|:---|:---|:---|:---|:---|:---|
|COLUMNAR_VM_BUFFER_SIZE|内存充足|- hash group
- hash join
- hash group/hash join都有的场景
|不优化|  
|  
|
|  
|内存不够，最大批次隐藏参数    `_COLUMNAR_MAX_BATCH_COUNT`    ，更好的触发|  
|内存不足时也有优化，对比主干较快|  
|  
|
|  
|内存不够->内存充足|- hash group
- hash join
- hash group/hash join都有的场景
|观察执行时间变快，  确认能尽快返回结果,观察hash join从磁盘模式执行切换回内存模式执行,  
|  
|  
|
|  
|内存充足>改小|  
|不生效|  
|  
|
|  
|  
|  
|  
|  
|  
|
|hash算子|hash group|- 含有group 不带聚集函数和distinct
|分别测试内存不够和内存够的场景  （改大内存后跟之前内存充足性能差不多）,与主干包对比执行变快|  
|  
|
|  
|  
|- 含有聚集函数不带distinct
|  
|  
|  
|
|  
|  
|- 含有聚集函数带distinct
|不优化|  
|  
|
|  
|  
|- 不含group，只有distinct
|  
|  
|  
|
|  
|hash join|- 2个表，都要大表
|分别测试内存不够和内存够的场景,与主干包对比执行变快|  
|  
|
|  
|  
|- 多个表、  仓库中复杂sql
|  
|  
|  
|
|  
|  
|- join的表含有大表，1000万数据以上
|  
|  
|  
|
|  
|  
|- 执行q13语句
|  
|  
|  
|
|  
|表中重复值比较多的场景，key重复|内存不够>内存充足|暂时无法优化|  
|  
|
|  
|  
|  
|  
|  
|  
|
|性能|  
|tpch，性能不能下降|  
|  
|  
|
|  
|  
|并发tpch：动态改内存大小，base环境，带该特性的环境|  
|  
|  
|


  


  


*2.*  *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*

|系统级DFX分类|是否涉及|
|:---|:---|
|CT|  
|
|KT|  
|
|长稳|  
|
|一致性|  
|
|三方测试工具    
  (sqltest，sqlancer)|  
|
|安全|  
|
|DFR|  
|
|HA|  
|
|压力|  
|
|性能|是|
|可维护性|  
|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


文本用例：     电子表

# 5. 测试框架设计

1. 功能测试guider框架已满足


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：

计划测试完成时间：

## Attachments: