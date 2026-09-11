Created by 梁绮菁, last modified on 四月 10, 2024

# 1.概述

描述列存支持lob更新删除的测试设计

sr：

  [YDBRD-12910](https://jira.yasdb.com/browse/YDBRD-12910?src=confmacro)    -  单机列表支持LOB更新删除  完成

  [YDBRD-13383](https://jira.yasdb.com/browse/YDBRD-13383?src=confmacro)    -  分布式列表支持LOB更新删除  完成

设计文档：

  [【Spearfish】LSC表LOB支持更新方案设计](112725448.html)  

  


# 2.需求分析

功能：支持列存的lob更新、删除（clob、blob类型的更新删除）

范围：单机、分布式

# 3.测试设计方法

1.采用场景法，覆盖以下场景：

- 基本语法结构，如子查询、where子句（and/or/not、is null、like、exists等）
- lob和varchar相互更新
- merge into+更新lob
- select for update+更新lob
- 事务提交与回滚
- 多表更新lob


2.边界值法：覆盖6种长度的边界值更新和删除。null、25、8000、24000（包括16000）、32000、>32000

# 4.详细测试设计

单机：

分布式：

补充复制表、分布表

  


# 5.测试用例

|用例编号|用例测试点|用例步骤|预期结果|实际结果|是否自动化|备注|
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
|test_sdv_blob_delete_01_tac|删除+单行|1. 建表带所有长度，指定行内，多次删除commit、回滚
1. 建表带所有长度，指定行内外，多次删除commit、回滚
|  
|pass|是|  
|
|test_sdv_blob_delete_02_tac|删除+63行|1. 建表带所有长度，指定行内，删除后回滚
1. 建表带所有长度，指定行内外，多次删除commit、回滚
|  
|pass|是|  
|
|test_sdv_blob_delete_03_tac|删除+全部行|1. 建表带所有长度，指定行内，全表删除后回滚
1. 建表带所有长度，指定行内外，多次删除commit、回滚
|  
|pass|是|  
|
|test_sdv_blob_delete_04_tac|删除+一级分区|1. 建range表带所有长度，指定行内外，全表删除后回滚，删除null后回滚，删除指定分区多长度，删除多分区多长度
1. 建interval表带所有长度，指定行内外，删除指定分区，删除多分区多长度，回滚，全表删除
1. 建list表带所有长度，指定行内外，删除多分区多长度，全表删除
1. 建hash表带所有长度，指定行内外，删除多分区多长度，全表删除
|  
|pass|是|  
|
|test_sdv_blob_delete_05_tac|删除+二级分区|1. 建range-range表带所有长度，指定行内外，全表删除后回滚，删除指定一级分区和二级分区，删除多分区多长度
1. 建range-list表带所有长度，指定行内外，删除指定分区，删除多分区多长度，回滚，全表删除
1. 建range-hash表带所有长度，指定行内外，删除多分区多长度，全表删除
1. 建list-hash表带所有长度，指定行内外，删除多分区多长度，全表删除
|  
|pass|是|  
|
|test_sdv_blob_update_01_tac|基本语法|1. 建表带check约束，插数查询
1. 建表带schema，插入查询，更新带别名，更新成功
1. 建表插数，更新多列，clob和blob相互更新失败，clob和blob和varchar相互更新成功
1. 更新带子查询
1. 更新带表达式，||成功，其他失败
1. 更新为default、null、''
1. 更新带运算符，不支持
1. 更新带between and，不支持
1. 更新带in，不支持
1. 更新带exists
1. 更新带like，无效
1. 更新带is null/is not null
1. 更新带and or not
1. 带order key更新
|  
|pass|是|  
|
|test_sdv_blob_update_02_01_tac|普通表+更新单行|1. 建表带所有长度，指定行内，更新为无效utf8的十六进制的所有长度，更新为有效uft8的十六进制的所有长度
1. 建表带所有长度，指定行内外
    1.  null更新为其他长度，有效uft8、无效uft8
    1. 25更新为其他长度，多列子查询
    1. 8000更新为其他长度，绑定参数
    1. 16000更新为其他长度，行外更新行内
    1. 24000更新为其他长度，行内更新行外
    1. 32000更新为其他长度，多列子查询
    1. 32000更新为其他长度，多列子查询，行内行外相互更新
|  
|pass|是|  
|
|test_sdv_blob_update_02_02_tac|普通表+更新63行|1. 建表带所有长度，指定行内，所有长度更新为null、24、25、5000、8000（有重复数据）、11000、16000、22000（有重复数据）、24000（有重复数据）、30000、32000（有重复数据），回滚，更新为null、24、26、8001、16001、24001、>32000
1. 建表带所有长度，指定行内外，多列子查询，行外更新行内
|  
|pass|是|  
|
|test_sdv_blob_update_02_03_tac|普通表+更新全部行+绑定参数|1. 建表带所有长度，指定行内外
    1. 父表的行内null更新子表的所有长度
    1. 父表的行内null更新为25，更新子表的所有长度
    1. 父表8000，更新子表所有长度
    1. 父表16000，更新子表所有长度
    1. 父表24000，更新子表所有长度
    1. 父表32000，更新子表所有长度
1. 建表带所有长度，指定行内外    

    1. 父表的行外null更新子表所有长度
    1. 父表的行外null更新为25，更新子表所有长度
    1. 父表8000，更新子表所有长度
    1. 父表16000，更新子表所有长度
    1. 父表24000，更新子表所有长度
    1. 父表32000，更新子表所有长度
|  
|pass|是|  
|
|test_sdv_blob_update_02_04_tac|分区表|1. 建range表带所有长度，指定行内外
    1. 分区内，更新为null、25、8000、16000、24000、32000、32000行内、32000行外
    1. 跨分区更新，行内更新其他，直接赋值、同行其他列、子查询、多列子查询、绑定参数
    1. 跨分区更新，行外更新其他，同行其他列、子查询、多列子查询、绑定参数
1. 建interval表带所有长度，指定行内外
    1. 跨分区，行内更新其他，绑定参数、直接赋值、同行其他列、多列子查询
1. 建list表带所有长度，指定行内外
    1. 跨分区，行内外相互更新，多列子查询，commit和rollback，绑定参数
1. 建hash表带所有长度，指定行内外
    1. 跨分区，多列子查询
|  
|pass|是|  
|
|test_sdv_blob_update_02_05_tac|二级分区表|1. 建range-range带所有长度，指定行内外
    1. 跨子分区更新，更新为null、25、8000，多列子查询
    1. 跨一级分区更新，更新为16000、24000、32000，多列子查询
1. 建range-list表带所有长度，指定行内外
    1. 行内更新其他，跨一级分区，更新为null、25、8000，跨子分区更新，更新为16000、24000、32000
    1. 行外更新其他，跨一级分区，更新为null、25、8000、16000、24000、32000
1. 建range-hash表带所有长度，指定行内外，绑定参数，整个分区跨分区更新，多次回滚和更新
|  
|pass|是|  
|
|test_sdv_blob_update_03_tac|varchar和lob相互更新+check|1. 建表带所有长度，指定行内外，varchar更新为lob（varchar=20、8000）
1. 建表带check约束，更新正常
1. 建表带所有长度，指定行内外，lob更新为varchar
|  
|pass|是|  
|
|test_sdv_blob_update_04_tac|主键+not null+alter table+merge into+多表更新、删除|1. 建表带主键约束和not null约束
1. 更新lob为null失败，非null成功
1. 同时更新主键和lob列
1. 增加lob列带not null default，指定行内外，插数、更新成功
1. 删除lob列，更新成功
1. 增加lob列不指定default，更新其他列为null
1. 建表带所有长度，指定行内外，matched update、matched update delete、not matched insert、matched+not matched，行内外相互更新
1. 建表带所有长度，指定行内外，多表更新和多表删除
|  
|pass|是|  
|
|test_sdv_clob_delete_01_tac|删除+单行|1. 建表带所有长度，指定行内，多次删除commit、回滚
1. 建表带所有长度，指定行内外，多次删除commit、回滚
|  
|pass|是|  
|
|test_sdv_clob_delete_02_tac|删除+63行|1. 建表带所有长度，指定行内，删除后回滚
1. 建表带所有长度，指定行内外，多次删除commit、回滚
|  
|pass|是|  
|
|test_sdv_clob_delete_03_tac|删除+全部行|1. 建表带所有长度，指定行内，全表删除后回滚
1. 建表带所有长度，指定行内外，多次删除commit、回滚
|  
|pass|是|  
|
|test_sdv_clob_delete_04_tac|删除+一级分区|1. 建range表带所有长度，指定行内外，全表删除，回滚，删除null，删除指定分区多长度，删除多分区多长度
1. 建interval表带所有长度，指定行内外，删除指定分区，删除多分区多长度，回滚，全表删除
1. 建list表带所有长度，指定行内外，删除多分区多长度，全表删除
1. 建hash表带所有长度，指定行内外，删除多分区多长度，全表删除
|  
|pass|是|  
|
|test_sdv_clob_delete_05_tac|删除+二级分区|1. 建range-range表带所有长度，指定行内外，全表删除，回滚，删除特定长度，删除指定分区多长度，删除多分区多长度
1. 建range-list表带所有长度，指定行内外，删除指定长度，删除多分区多长度，回滚，全表删除
1. 建range-hash表带所有长度，指定行内外，删除多分区多长度，全表删除
1. 建list-hash表带所有长度，指定行内外，删除多分区多长度，全表删除
|  
|pass|是|  
|
|test_sdv_clob_update_01_tac|基本语法|1. 建表带check约束，插数查询
1. 建表带schema，插入查询，更新带别名，更新成功
1. 建表插数，更新多列，clob和blob相互更新失败，clob和blob和varchar相互更新成功
1. 更新带子查询
1. 更新带表达式，||成功，其他失败
1. 更新为default、null、''
1. 更新带运算符，不支持
1. 更新带between and，不支持
1. 更新带in，不支持
1. 更新带exists
1. 更新带like，无效
1. 更新带is null/is not null
1. 更新带and or not
1. 带order key更新
|  
|pass|是|  
|
|test_sdv_clob_update_02_01_tac|普通表+更新单行|1. 建表带所有长度，指定行内，更新为无效utf8的十六进制的所有长度，更新为有效uft8的十六进制的所有长度
1. 建表带所有长度，指定行内外
    1.  null更新为其他长度，有效uft8、无效uft8
    1. 25更新为其他长度，多列子查询
    1. 8000更新为其他长度，绑定参数
    1. 16000更新为其他长度，行外更新行内
    1. 24000更新为其他长度，行内更新行外
    1. 32000更新为其他长度，多列子查询
    1. >32000更新为其他长度，多列子查询，行内行外相互更新
|  
|pass|是|  
|
|test_sdv_clob_update_02_02_tac|普通表+更新63行|1. 建表带所有长度，指定行内，所有长度更新为null、24、25、5000、8000（有重复数据）、11000、16000、22000（有重复数据）、24000（有重复数据）、30000、32000（有重复数据）、>32000（有重复数据），回滚，更新为null、24、26、8001、16001、24001、>32000
1. 建表带所有长度，指定行内外，多列子查询，行外更新行内
|  
|pass|是|  
|
|test_sdv_clob_update_02_03_tac|普通表+更新全部行+绑定参数|1. 建表带所有长度，指定行内外
    1. 父表的行内null更新子表的所有长度
    1. 父表的行内null更新为25，更新子表的所有长度
    1. 父表8000，更新子表所有长度
    1. 父表16000，更新子表所有长度
    1. 父表24000，更新子表所有长度
    1. 父表32000，更新子表所有长度
    1. 父表>32000，更新子表所有长度
1. 建表带所有长度，指定行内外    

    1. 父表的行外null更新子表所有长度
    1. 父表的行外null更新为25，更新子表所有长度
    1. 父表8000，更新子表所有长度
    1. 父表16000，更新子表所有长度
    1. 父表24000，更新子表所有长度
    1. 父表32000，更新子表所有长度
    1. 父表>32000，更新子表所有长度
|  
|pass|是|  
|
|test_sdv_clob_update_02_04_tac|分区表|1. 建range表带所有长度，指定行内外
    1. 分区内，更新为null、25、8000、16000、24000、32000、>32000行内、>32000行外
    1. 跨分区更新，行内更新其他，直接赋值、同行其他列、子查询、多列子查询、绑定参数
    1. 跨分区更新，行外更新其他，同行其他列、子查询、多列子查询、绑定参数
1. 建interval表带所有长度，指定行内外
    1. 跨分区，行内更新其他，绑定参数、直接赋值、同行其他列、多列子查询
1. 建list表带所有长度，指定行内外
    1. 跨分区，行内外相互更新，多列子查询，commit和rollback，绑定参数
1. 建hash表带所有长度，指定行内外
    1. 跨分区，多列子查询
|  
|pass|是|  
|
|test_sdv_clob_update_02_05_tac|二级分区表|1. 建range-range带所有长度，指定行内外
    1. 跨子分区更新，更新为null、25、8000，多列子查询
    1. 跨一级分区更新，更新为16000、24000、32000、>32000，多列子查询
1. 建range-list表带所有长度，指定行内外
    1. 行内更新其他，跨一级分区，更新为null、25、8000，跨子分区更新，更新为16000、24000、32000、>32000
    1. 行外更新其他，跨一级分区，更新为null、25、8000、16000、24000、32000、>32000
1. 建range-hash表带所有长度，指定行内外，绑定参数，整个分区跨分区更新，多次回滚和更新
|  
|pass|是|  
|
|test_sdv_clob_update_03_tac|varchar和lob相互更新+check|1. 建表带所有长度，指定行内外，varchar更新为lob（varchar=20、8000）
1. 建表带check约束，更新正常
1. 建表带所有长度，指定行内外，lob更新为varchar
|  
|pass|是|  
|
|test_sdv_clob_update_04_tac|主键+not null+alter table+merge into+多表更新、删除|1. 建表带主键约束和not null约束
1. 更新lob为null失败，非null成功
1. 同时更新主键和lob列
1. 增加lob列带not null default，指定行内外，插数、更新成功
1. 删除lob列，更新成功
1. 增加lob列不指定default，更新其他列为null
1. 建表带所有长度，指定行内外，matched update、matched update delete、not matched insert、matched+not matched，行内外相互更新
1. 建表带所有长度，指定行内外，多表更新和多表删除
|  
|pass|是|  
|


# 6.测试框架

select for update手动测试，其余使用guider、ha、一致性、并发框架

# 7.测试环境

|版本|环境|
|---|---|
|linux|单机|


## Attachments:

[lob更新删除.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZjlhMWFkOWEzMzExZGM3OWQ0IiwicmVmX2lkIjoiNjczOTY5Zjk3MjgyMDZlZmI5MmVmOTYwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwNTA3LCJleHAiOjE3ODIyOTY5MDd9.d7VT8w7Aeure1-yoHa3ExS7a0DcFTTgqLqWQKonY4xo)

 (application/x-xmind)    


[lob更新删除.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZjlhMWFkOWEzMzExZGM3OWQ1IiwicmVmX2lkIjoiNjczOTY5Zjk3MjgyMDZlZmI5MmVmOTYwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwNTA3LCJleHAiOjE3ODIyOTY5MDd9.vNP4HRJvRcy0hQZzX2DzWcZ5xobS-JHcuk8wc-kXl4U)

 (image/png)    


[lob更新删除.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5Zjk4OTcwYzJhZjRmNTFmYjVlIiwicmVmX2lkIjoiNjczOTY5Zjk3MjgyMDZlZmI5MmVmOTYwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwNTA3LCJleHAiOjE3ODIyOTY5MDd9.q8SmwrelLajUKVyPALFFQMtXZkvfFfzyS58tBsCisGc)

 (application/x-xmind)    


[lob更新删除.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5Zjk4OTcwYzJhZjRmNTFmYjVmIiwicmVmX2lkIjoiNjczOTY5Zjk3MjgyMDZlZmI5MmVmOTYwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwNTA3LCJleHAiOjE3ODIyOTY5MDd9.82prboXx_8jrSOP1xIFlCJnm9Vc5Gj5SipdXJVHOKd0)

 (application/x-xmind)    


[lob更新删除.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZjlhMWFkOWEzMzExZGM3OWQ2IiwicmVmX2lkIjoiNjczOTY5Zjk3MjgyMDZlZmI5MmVmOTYwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwNTA3LCJleHAiOjE3ODIyOTY5MDd9.cDd2bYVnGTjIwViEtsD91ZoxiPwpT-wfuLnnY20y3Mg)

 (application/x-xmind)    
