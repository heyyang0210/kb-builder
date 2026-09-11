Created by 梁绮菁, last modified on 一月 23, 2024

# 1.概述

描述sequence支持currval的测试设计

sr：    [YDBRD-13465](https://jira.yasdb.com/browse/YDBRD-13465?src=confmacro)    -  sequence支持currval功能  完成

开发设计：    [sequence currval](https://conf.yasdb.com/display/~zhangzhipeng/sequence+currval)  

# 

# 2.需求分析

1.功能：

- 实现获取sequence的当前值（当前会话的上一次nextval）的功能


如：select seq1.currval from dual;

2.限制：

- 仅支持单机，不支持备机、集群、分布式
- 仅支持行表，不支持列表




# 3.测试设计方法

1.采用场景法

单sequence场景

场景1：同时查询nextval、currval：如select seq.nextval,seq.currval from dual

场景2：同时查询currval、nextval：如select seq.currval,seq.nextval from dual

场景3：同时查询currval：如select seq.currval,seq.currval from dual

  


多sequence场景（两个sequence）

场景1：同时查询seq1的nextval和seq2的currval：如select seq1.nextval,seq2.currval from dual

场景2：同时查询seq1的currval和seq2的nextval：如select seq1.currval,seq2.nextval from dual

场景3：同时查询seq1和seq2的currval：如select seq1.currval,seq2.currval from dual

场景4：查询seq1、seq2的nextval和seq2的currval

场景5：查询seq1的currval和seq2的nextval和seq2的currval

  


2.边界值测试

测试不同步长、最值、cycle/nocyle的场景下，alter sequence后查询currval和nextval、currval结果是否正确



# 4.详细测试设计

![](https://pingcode.yasdb.com/atlas/files/public/673969df8970c2af4f51fb06/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDk2NzMsImV4cCI6MTc4MjIyMDQ3M30.kFskMl0iyq4Gf_Kx_-7hL4n0c5_LFtsLzIa4cS6M2qw)







# 5.文本用例

|用例编号|用例测试点|用例步骤|预期结果|实际结果|是否自动化|备注|
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
|test_sdv_sequence_currval_01|查询currval无定义,查询nextval，再查currval,from dual|1. 建sequence，查询nextval后查询currval，多次查询
1. 边界值
    1. 升序
        1. nextval到=最大值后查询currval----预期不变
        1. nextval到>最大值，查询currval---预期不变
        1. cycle时查询currval----预期循环
    1. 降序，和升序同样场景
1. 多次创建删除sequence，查询nextval和currval
|  
|pass|是|  
|
|test_sdv_sequence_currval_02|1. 查询多行表
1. 单独查询nextval、currval
1. 同时查询nextval、currval：
    1. 单个sequence
    1. 多个sequence（升序、降序）
1. select sequence带where、in、join
1. from heap表
1. from空表
1. from不存在的表
1. from列表
|1. 建表插数
1. 覆盖测试点
|  
|pass|是|  
|
|test_sdv_sequence_currval_03|kill场景|1.建sequence，查询nextval、currval,2.重启数据库后查询currval、nextval,3.再重启,4.建降序sequence，重复上述步骤|  
|pass|是|  
|
|test_sdv_sequence_currval_04|insert、update、insert into select、无效、插数后删sequence场景|1. insert
    1. 查询nextval，insert使用currval
    1. 同时使用nextval，currval插数
    1. 重复使用currval插数
    1. 使用currval插入主键列
1. update
    1. 使用nextval，更新为currval
    1. 同时使用currval、nextval更新
    1. 重复使用currval更新----失败后drop主键、唯一键约束后更新
1. insert into select
    1. 查询nextval，使用currval插数
    1. 同时使用nextval，currval插数—插入单行、多行、sequence循环
    1. 重复使用currval插数----成功后加主键、唯一键约束插入失败
1. 无效场景：where、group by、in、子查询、join、union
1. 使用sequence插入主键后删除sequence，查询表数据
|  
|pass|是|  
|
|test_sdv_sequence_currval_07|alter sequence、create sequence无效场景|1. 建sequence使用其他sequence
1. alter步长后查询currval、nextval
1. alter边界值后查询currval、nextval（循环sequence、非循环sequence）
1. 降序sequence重复上述步骤
1. alter cache、nocache后查询currval、nocache
1. alter初始值
|  
|pass|是|  
|
|  
|  
|  
|  
|  
|  
|  
|


# 6.测试框架

自动化用例添加到yasft框架、ha框架、testkill框架中

# 7.测试环境

|版本|环境|
|:---:|:---:|
|linux|单机|


## Attachments:

[sequence支持currval功能.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZGZhMWFkOWEzMzExZGM3OTc5IiwicmVmX2lkIjoiNjczOTY5ZGY1OTNmOTljOWZmMjM1M2JlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5NjcyLCJleHAiOjE3ODIyOTYwNzJ9.XxfJM03P0eK4VM4u7h7GqOIVuBo-6JBxVYD9u4BTUAs)

 (application/x-xmind)    


[sequence支持currval功能.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZGY4OTcwYzJhZjRmNTFmYjA0IiwicmVmX2lkIjoiNjczOTY5ZGY1OTNmOTljOWZmMjM1M2JlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5NjcyLCJleHAiOjE3ODIyOTYwNzJ9.KJcVOE65InSjc1gYSlmNDKDDggyXF7CvrzdQarGcrTM)

 (application/x-xmind)    


[sequence支持currval功能.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZGY4OTcwYzJhZjRmNTFmYjA1IiwicmVmX2lkIjoiNjczOTY5ZGY1OTNmOTljOWZmMjM1M2JlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5NjcyLCJleHAiOjE3ODIyOTYwNzJ9.HaxrJ3-gX7anhK901vFw7figr0cxWHiIvIU-zkspNSs)

 (application/x-xmind)    


[sequence支持currval功能.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZGZhMWFkOWEzMzExZGM3OTdhIiwicmVmX2lkIjoiNjczOTY5ZGY1OTNmOTljOWZmMjM1M2JlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5NjcyLCJleHAiOjE3ODIyOTYwNzJ9.5vfAT1ssmE00FSOuT_7Z2x-H_xegxhV8MYy2PfJ72SU)

 (application/x-xmind)    
