Created by 高亚宁, last modified by  梁绮菁 on 四月 08, 2024

# ** 概述**

序列是数据库对象一种。多个用户可以通过序列生成连续的数字以此来实现主键字段的自动、唯一增长，并且一个序列可为多列、多表同时使用。

SR:     [YDBRD-13517](https://jira.yasdb.com/browse/YDBRD-13517?src=confmacro)    -  【共享集群】集群支持sequence  完成

开发设计：    [集群支持sequence - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=107390452)  

# **2. 需求分析**

集群支持sequence create、alter、drop、使用

**1、语法:**

![](https://pingcode.yasdb.com/atlas/files/public/673969d9a1ad9a3311dc795d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFnQUFBQUFBUUFBQUFBQUFBQUFBQUFBSUFBQVFBQUFBQUJBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQWdBQUFBQUNBQUFBQUFBQUFBQUFBSUFBQkFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUVDQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDk0ODQsImV4cCI6MTc4MjIyMDI4NH0.K5LIqUfvM1cKBAEJaHNu5VDHAkC_RZBoeUW2JNDco0U)

![](https://pingcode.yasdb.com/atlas/files/public/673969d98970c2af4f51fae7/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFnQUFBQUFBUUFBQUFBQUFBQUFBQUFBSUFBQVFBQUFBQUJBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQWdBQUFBQUNBQUFBQUFBQUFBQUFBSUFBQkFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUVDQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDk0ODQsImV4cCI6MTc4MjIyMDI4NH0.K5LIqUfvM1cKBAEJaHNu5VDHAkC_RZBoeUW2JNDco0U)

![](https://pingcode.yasdb.com/atlas/files/public/673969d98970c2af4f51fae8/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFnQUFBQUFBUUFBQUFBQUFBQUFBQUFBSUFBQVFBQUFBQUJBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQWdBQUFBQUNBQUFBQUFBQUFBQUFBSUFBQkFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUVDQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDk0ODQsImV4cCI6MTc4MjIyMDI4NH0.K5LIqUfvM1cKBAEJaHNu5VDHAkC_RZBoeUW2JNDco0U)

**支持seq currval**

**create seq支持order/noorder语法**

**2、功能限制**

- sequence的缓存是实例级别，有可能会造成全局的序列值乱序，但可以保证每个实例内部序列值递增


# **3. 测试**  **设计方法**   

主要采用场景法进行测试

### 3.1测试范围：

1. Rac部署形态；
1. Rac下，create、alter、drop sequence、sequence currval语法及功能测试，重点校验每个属性的范围、是否生效、限制——复用现有单机seq的用例，在不同的实例上分别执行，预期结果与单机一致
1. seq在Rac下与单机的差异点：执行    `alter sequence`    的实例向其他实例广播，重点测试在不同实例上alter seq的不同属性后，HWM的变化及调用是否正常
1. 并发：多实例间create、alter、drop并发，并发调用seq  ，  校验seq的  正确性和稳定性
1. testkill：create、alter、drop sequence时，本实例或其他实例kill重启，重点测试alter


### 3.2功能交互：

1. 表中并发调用sequence的nextval，当seq.nextval超过表的列定义的长度时，插入报错


### 3.3专项覆盖

|专项|是否涉及|说明|
|:---|:---|---|
|并发|涉及|  
|
|长稳|不涉及|  
|
|一致性|不涉及|  
|
|三方测试工具    
  (sqltest，sqlancer)|不涉及|  
|
|安全|不涉及|  
|
|DFR/testkill|涉及|  
|
|HA|不涉及|  
|
|压力|不涉及|  
|
|性能|不涉及|  
|
|可维护性|不涉及|  
|
|兼容性|不涉及|  
|


# 4.   **详细测试设计**   

[Rac_sequence.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZDhhMWFkOWEzMzExZGM3OTU5IiwicmVmX2lkIjoiNjczOTY5ZDg3MjgyMDZlZmI5MmVmODMyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5NDg0LCJleHAiOjE3ODIyOTU4ODR9.5Q9DEVs1QHvYYQ_gDKHEbpV_6UjodFICayFCt6_ee2A)

# 5.   **测试用例**

|用例编号|用例测试点|用例步骤|预期结果|实际结果|是否自动化|备注|
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
|test_sdv_create_sequence_01|建sequence+查询nextval、currval from dual/自定义表|1. node1建sequence，推水位线多次后读到cache最后一个
1. 不断开node1会话新开node2会话
    1. 查询currval----失败
    1. 同时查询nextval、currval----成功
    1. 查询nextval，推水位线多次-----结果正确
1. 回到node1
    1. 查询currval-----结果不变
    1. 查询nextval，推水位线1次----结果正确
1. node3查询
    1. 查询currval----失败
    1. 查询nextval from自定义表，推水位线1次----结果正确
1. node1查询nextval----结果正确，读完cache，推水位线1次-----结果正确
1. node3读完cache，推水位线1次，读到cache最后一个----结果正确
1. node2查询netval----结果正确，读完cache，推水位线1次后删除sequence，查询currval、nextval----失败
1. 回到node1，查询currval、nextval-----失败
1. 回到node3，查询currval、nextval-----失败
1. 降序重复上述步骤
|  
|pass|是|用例步骤为3实例为例|
|test_sdv_create_sequence_02|建sequence+,查询nextval、currval from dual/自定义表+,hwm=边界值+,hwm>边界值+,多次查询nextval超范围后查询currval|1. hwm=边界值
    1. node1建sequence，读到hwm=最大值
    1. node2查询
        1. 查询currval-----失败
        1. 查询nextval----结果正确，继续查询nextval-----报错，查询currval-----不变
    1. node1查询nextval----结果正确，读完cache后查询-----报错，查询currval----不变
1. hwm>边界值
    1. node1建sequence，读到hwm>最大值
    1. node2查询nextval、currval----失败
    1. node1查询----结果正确，读完cache后查询----报错，查询currval----不变
    1. ---------------------
    1. node1重建sequence，推水位线令node2边界在cache内
    1. node2查询到报错，查询currval----不变
    1. node1查询---结果正确，读完cache后查询----报错，查询currval----不变
    1. -------------------
    1. node1重建sequence，推水位线令node2边界在cache最后一个
    1. node2查询到报错，查询currval----结果不变
    1. node1查询---结果正确，读完cache后查询----报错，查询currval---不变
1. 降序重复上述步骤
|  
|pass|是|  
|
|test_sdv_create_sequence_03|建sequence+cache|1. node2建sequence+cache 10
    1. 查询currval----失败
    1. 查询nextval----成功
    1. node3查询currval失败，nextval成功，hwm>边界
    1. node1查询curval、nextval失败
    1. node2查询nextval---结果正确，读完cache后查询------报错
    1. node3查询nextval----结果正确，读完cache后查询------报错
1. node3建sequence+nocache
    1.  hwm=边界
        1. 查询多次nextval
        1. node2查询currval报错，查询nextval----结果正确
        1. node1查询currval报错，查询nextval----结果正确，读到hwm=边界
        1. 回到node2查询currval---不变，查询nextval----结果正确，查询nextval报错，查询currval不变
        1. 回到node3，查询currval不变，查询nextval报错，查询currval不变
        1. 回到node1，查询currval不变，查询nextval报错，查询currval不变
    1. hwm>边界，重复上述步骤
1. 降序+cache 1
    1. node2建sequence，查询currval失败，查询nextval成功
    1. node3查询currval失败，查询nextval成功
    1. node1查询currval、nextval失败
    1. node2查询nextval成功，再查询报错，查询currval不变
    1. node3查询nextval报错，查询currval不变
1. 降序+nocache重复上述步骤
|  
|pass|是|  
|
|test_sdv_create_sequence_04|建sequence+cycle+,node1读到cache最后一个，node2推线到最大+,node2推线到node1的hwm后+,node1读cache内，node2读到最大(hwm>最大)+,node2推线到node1的hwm前+,node1读到cache最后一个，node2推线到循环+,node1推线到node2的hwm+,  
,  
|1. node1建sequence，读到cache最后一个
    1. node2读到cache内，hwm=最大
    1. 回到node1查询nextval----读到最大，再次查询----循环，再次查询，推水位线1次---结果正确
1. node2查询---结果正确，读完cache后查询，推线到node1的hwm后-----结果正确
    1. node1查询---结果正确，读完cache后查询----结果正确
    1. node1读到最大再循环----结果正确
1. node1建sequence，读到cache内
    1. node2查询，读到最大----结果正确
    1. node1查询----结果正确，读完cahce后查询---循环，循环后推线1次
1. node2查询----结果正确
    1. node2读到最大后循环，推线到node1的hwm前-----结果正确
    1. node1查询---结果正确，读完cache后查询----结果正确，读到最大后循环
1. node1建sequence，读到cache最后一个，hwm=最大
    1. node2查询nextval---读到最大，再次查询----循环
    1. node1查询—结果正确
    1. node1读到最大后循环，推线到node2的hwm----结果正确
1. node2查询----结果正确，再次查询，推线2次---结果正确
1. 降序重复上述步骤
|  
|pass|是|  
|
|test_sdv_create_sequence_05|建squence+cycle+nocache+,node2推线到最大(hwm<最大<hwm+步长)+,node2读到最大+,node2推线到最大(hwm>最大)+,node2推线到最大(hwm=最大)+,node2推线到node1的hwm前(当前值-1)+,node2推线到node1的hwm前(当前值+1)+,node2推线到node1的hwm前(当前值)+,node2推线到node1的hwm|1. node1建sequence，多次查询----结果正确    

    1. node2推线到最大，hwm<最大<hwm+步长
    1. node1查询----结果正确，再次查询----循环，多次查询---结果正确
1. node2读到最大
    1. node1查询-----变到最小，多次查询----结果正确
1. node1建sequence，多次查询----结果正确
    1. node2推线到最大----结果正确
    1. node1查询----变到最小，多次查询-----结果正确
1. node2查询----结果正确，推线到最大—结果正确
    1. node1查询----读到最大，再次查询---循环，再次循环---结果正确
1. node1建sequence，多次查询—结果正确
    1. node2多次查询到循环，推线到node1的hwm前
    1. node1查询---结果正确
1. node1建sequence，多次查询—结果正确
    1. node2查询到循环，推线到node1的hwm前
    1. node1查询---结果正确
1. node1建sequence，多次查询----结果正确
    1. node2多次查询到循环，推线到node1的hwm前
    1. node1查询---nextval结果不变，多次查询---结果正确
1. node1建sequence，多次查询----结果正确
    1. node2多次查询到循环，推线到node1的hwm
    1. node1查询---结果正确
1. 降序重复上述步骤
|  
|pass|是|  
|
|test_sdv_create_sequence_06|建sequence+order+cache+,1. 3实例相互查询+
1. maxvalue在cache最后一个，node1读到cache内(<<最大)，node2读cache最后一个(最大)+
1. maxvalue在cache最后一个，node2读到cache倒数第二个，node1读cache最后一个(最大)+
1. maxvalue在cache的下一个，node1读到cache最后一个(<<最大)，node2读cache最后一个(<最大，hwm=最大 )+
1. maxvalue在cache的下一个，node1读到cache最后一个(<<最大)，node2读cache倒数第二个+
1. maxvalue在cache的下一个，node1读到cache最后一个(<<最大)，node2读cache下一个(最大)+
1. maxvalue>cache中间，node1读cache内(<<最大)，node2读cache最后一个(<最大<hwm)+
1. maxvalue>cache中间，node1读cache最后一个(<<最大)，node2读cache倒数第二个+
1. maxvalue=cache中间，node1读cache最后一个(<<最大)，node2读到最大+
1. maxvalue=cache中间，node1读cache内(<<最大)，node2读cache倒数第二个
,  
,  
|1. node1建sequence
    1.  node2查询currval失败，查询nextval成功
    1. node1查询currval失败，查询nextval----结果正确
    1. node2查询nextval----结果正确
    1. node1查询----结果正确，读到cache倒数第二个
    1. node3读到cache最后一个，再次查询，推水位线1次
    1. node1查询----结果正确
    1. node2查询----结果正确
    1. node3查询----结果正确
1. node1建sequence+cache 31
    1. node1查询currval失败，查询nextval成功，读到cache内(<<最大)
    1. node2查询currval失败，查询nextval成功，读到最大
    1. node1查询nextval、currval----报错
    1. node2查询nextval、currval-----报错
1. node1建sequence+cache 31
    1. node1查询currval失败，nextval成功
    1. node2查询currval失败，nextval成功，读到cache倒数第二个
    1. node1读到cache最后一个，再次查询报错，查询currval不变
    1. node2查询nextval、currval-----报错
1. node1建sequence
    1. node1查询currval失败，查询nextval成功，读到cache最后一个(<<最大)
    1. node2查询currval失败，查询nextval成功，读到cache最后一个
    1. node1查询读到最大，再次查询报错，查询currval不变
    1. node2查询nextval、currval报错
1. node1建sequence
    1. node1查询currval失败，查询nextval成功，读到cache最后一个(<<最大)
    1. node2查询currval失败，nextval成功，读到cache倒数第二个
    1. node1查询----结果正确，查询读到最大，再次查询报错，查询currval不变
    1. node2查询nextval、currval报错
    1. node3查询nextval、currval报错
1. node1建sequence
    1. node1查询currval报错，查询nextval成功，读到cache最后一个(<<最大)
    1. node2查询currval报错，查询nextval成功，读到最大
    1. node1查询nextval、currval报错
    1. node2查询nextval、currval报错
    1. node3查询nextval、currval报错
1. node1建sequence+cache 2
    1. node1查询currval报错，nextval成功，读到cache内(<<最大)
    1. node2查询currval报错，nextval成功，读到cache最后一个(<最大<hwm)
    1. node1查询nextval、currval报错
    1. node2查询nextval、currval报错
    1. node3查询nextval、currval报错
1. node1建sequence
    1. node1查询currval报错，nextval成功，读到cache最后一个(<<最大)
    1. node2查询currval报错，nextval成功，读到cache倒数第二个
    1. node1查询----结果正确，再次查询---报错，查询currval-----不变
    1. node2查询nextval、currval报错
    1. node3查询nextval、currval报错
1. node1建sequence
    1. node1查询currval失败，nextval成功，读到cache最后一个(<<最大)
    1. node2查询currval失败，nextval成功，读到最大
    1. node1查询nextval、currval报错
    1. node2查询nextval、currval报错
    1. node3查询nextval、currval报错
1. node1建sequence
    1. node1查询currval失败，nextval成功，读到cache内(<<最大)
    1. node2查询currval失败，nextval成功，读到cache倒数第二个
    1. node1查询读到最大，再次查询报错，查询currval不变
    1. node2查询nextval、currval报错
    1. node3查询nextval、currval报错
1. 降序重复上述步骤
|  
|pass|是|  
|
|test_sdv_create_sequence_07|建sequence+cache+cycle+,1. maxvalue在cache最后一个，node1读cache内，node2读cache最后一个+
1. maxvalue>cache最后一个，node2读cache最后一个，node1读前一个+
1. maxvalue在cache最后一个，node1读cache最后一个，node2读cache前一个+
1. maxvalue在cache的下一个，node2读cache内，node1读cache最后一个+
1. maxvalue在cache的下一个，node1读cache最后一个，node2读前一个+
1. maxvalue在cache的下一个，node2读cache内，node1读下一个+
1. maxvalue>cache最后一个，node1读cache内，node2读cache最后一个+
1. maxvalue=cache中间，node2读cache最后一个，node1读最后一个+
1. maxvalue=cache中间，node1读cache最后一个，node2读前一个
,  
|1. node1建sequence+cache 50，读到cache内(<<最大)
    1. node3推水位线多次，读到cache倒数第二个(<<最大)
    1. node2推水位线多次，读到cache最后一个(=最大)
    1. node1查询----循环，读到cache内(<<最大)
1. node1读到cache倒数第二个
    1. node2查询读到cache最后一个----结果变小(<最大<hwm)，继续查询会循环，读到cache内(<<最大)
    1. node1查询----结果变小
    1. node3查询----结果正确
1. node1建sequence+cache 10，读到cache最后一个(<<最大)
    1. node2读到cache倒数第二个
    1. node1读到最大，继续查询----循环，读到cache内(<<最大)
1. node1读到cache最后一个(+步长=最大=hwm)，当前值与node2相同（hwm不同）
    1. node2查询读到最大，再次查询会循环，读到cache内(<<最大)
1. node2读到cache倒数第二个，下一个与node1当前值相同（hwm相同）
    1. node1查询----结果不变，再次查询会循环，读到cache内(<<最大)
1. node1读到最大
    1. node2查询会循环，读到cache内(<<最大)
    1. node1查询----结果正确
    1. node3查询----结果正确
1. node1建sequence，读到cache内
    1. node2读到cache最后一个(<最大<hwm)
    1. node1查询会循环----结果变小，读到cache内(<<最大)
1. node1读到最大，当前值与node2不同，但都是最后一个（hwm不同）
    1. node2查询会循环，读到cache内(<<最大)
1. node2读到cache倒数第二个，下一个与node1当前值相同（hwm相同）
    1. node1查询----结果正确，再次查询会循环，推水位线1次
    1. node3查询----结果正确
1. 降序重复上述步骤
|  
|pass|是|  
|
|test_sdv_create_sequence_08|建sequence+order+nocache+,1. maxvalue=hwm，node2读maxvalue前一个
1. maxvalue=hwm，node2读maxvalue
1. maxvalue<hwm，node2读前一个
1. maxvalue<hwm，node2读最大
|1. node1建sequence，查询多次
    1. node2查询多次
    1. node3查询多次
    1. node1查询-----结果正确
    1. node2查询-----结果正确，推水位线到最大(hwm=最大)
    1. node1查询-----结果正确，再次查询—报错，currval不变
    1. node2查询nextval、currval----报错
    1. node3查询nextval、currval----报错
1. node1建sequence，查询多次
    1. node2读到最大
    1. node1查询nextval、currval报错
    1. node2查询nextval、currval报错
    1. node3查询nextval、currval报错
1. node1建sequence
    1. node3、node1、node2相互查询-----结果正确
    1. node2读到前一个(最后一个<最大)
    1. node1查询----结果正确，再次查询----报错，currval不变
    1. node2查询nextval、currval报错
    1. node3查询nextval、currval报错
1. node2建sequence
    1. node3、node1查询多次
    1. node2读到最后一个(<最大)
    1. node1查询nextval、currval报错
    1. node2查询nextval、currval报错
    1. node3查询nextval、currval报错
1. 降序重复上述步骤
|  
|pass|是|  
|
|test_sdv_create_sequence_09|建sequence+order+nocache+cycle,1. maxvalue=hwm，node2读maxvalue前一个
1. maxvalue<hwm，node1读前一个
1. maxvalue=hwm，node2读maxvalue
1. maxvalue<hwm，node3读最大
|1. node1建sequence
    1. node1、node2、node3相互查询
    1. node2读到前一个(最后一个=最大)
    1. node1查询----结果正确，再次查询会循环
    1. node2查询----结果正确
    1. node3查询-----结果变小
1. node1读到前一个(最后一个<最大)
    1. node2查询----结果正确，再次查询会循环
    1. node3查询----结果正确
    1. node1查询-----结果正确
1. node3建sequence
    1. node1查询-----结果正确
    1. node2读到最大
    1. node1查询会循环
    1. node2查询----结果正确
    1. node3查询-----结果正确
1. node3读到最后一个(<最大)
    1. node1查询会循环
    1. node2查询-----结果正确，推线到node3当前值
    1. node3查询----结果不变，再次查询会循环
1. 降序重复上述步骤
|  
|pass|是|  
|
|test_sdv_create_sequence_10|不同schema同名sequence+创建、删除sequence|1. node1建sequence，node2建同名sequence----失败
    1. node3查询，推水位线1次----结果正确
    1. node1查询，推水位线1次-----结果正确
    1. node2查询，推水位线1次-----结果正确
1. node1建user1的sequence，node2建regress同名sequence+cycle+order-----成功
    1. node2查询，推user1.sequence水位线1次-----结果正确
    1. node1查询regress.sequence，推水位线1次----结果正确，查询user1.sequence，推水位线1次----结果正确
    1. node2多次查询user1.sequence，推水位线1次，查询regress.sequence，不推水位线----结果正确，读到cache最后一个
    1. node3查询regress.sequence，推水位线1次，继续查询----结果循环
    1. node3删除regress.sequence后查询---报错，查询user1.sequence---结果正确，删除user1.sequence后node1、node2查询----报错
1. node1创建并查询sequence
    1. node1删除，node2查询--------报错
    1. node3删除-------报错
    1. node2创建sequence，node1查询-----结果正确
    1. node1删除后查询----报错
|  
|pass|是|  
|
|test_sdv_alter_sequence_01|alter sequence+边界值+,1. node1读cache内，node2改maxvalue为当前hwm
1. 超过最大改大，改后hwm>maxvalue
1. 超过最大改大，改后hwm<maxvalue
1. 当前+新步长
|1. node1建sequence
    1. node1查询，读到cache内
    1. node2查询一次，改最大值为hwm----结果正确
    1. node1查询----结果正确，读到最大----结果正确，继续查询会报错，查询currval不变
1. node1改大最大值，改后hwm>maxvalue
    1. node1查询nextval、currval报错
    1. node2查询nextval、currval报错
1. node1不查询直接改大最大值，改后hwm<maxvalue
    1. node2查询------结果正确，读到最后一个(<最大<hwm)，继续查询报错
    1. node1查询报错
1. node1建sequence+步长=2
    1. node1查询1次
    1. node2不查询直接修改步长为5
    1. node1不查询直接改大最大值
    1. node1读到最大后查询报错，currval不变
    1. node2查询报错
|  
|pass|是|  
|
|test_sdv_alter_sequence_02|alter sequence+步长|1. node1建sequence，读到cache最后一个
    1. 改步长后hwm=最大值
    1. node2查询nextval----成功，继续查询---报错，查询currval----结果正确
    1. node1查询nextval报错，currval正确
1. node1建sequence，读到cache最后一个
    1. node2改步长后node1查询----结果循环
    1. node2查询---结果正确，node1查询----结果正确
1. node1建sequence，读到cache内，node2读到cache最后一个，改步长>最大，查询报错
    1. node1查询报错，改步长<最大，查询结果正确
1. node1建sequence，读到cache内
    1. node2查询，读到cache最后一个，改步长
    1. node1查询-----结果循环
    1. node2查询----结果正确
1. node1建sequence，读到最大
    1. node2改步长为降序，查询-----结果正确
    1. node1查询----结果正确
1. node1建sequence，读到cache内
    1. node2查询到最大，改步长为降序
    1. node1查询----结果正确
    1. node2查询----结果正确
|  
|pass|是|  
|
|test_sdv_alter_sequence_03|alter sequence+cycle|1. node1建sequence，查询到最大，报错后改为cycle
    1. node2查询----结果正确
    1. node1查询----结果正确
1. node1建sequence，读到cache内，改为nocycle
    1. node2查询------结果正确
1. node1建sequence，读到cache内
    1. node3改最小值
    1. node1查询到最大，报错后改为cycle，查询currval和nextval----结果正确
    1. node3查询----结果正确
1. node1建sequence，查询后改最小值
    1. node2查询后改为cycle
    1. node1查询----结果正确
    1. node3查询----结果正确，改为nocycle
    1. node1、node2、node3查询----结果正确
    1. node3改为cycle，查询正确
    1. node2改为nocycle，node3查询正确
    1. node1改为cycle，node3、node2查询正确
    1. node2改为nocycle，node1查询正确，node1改为cycle，node1查询正确，node1改为nocycle，查询正确
1. node1建squence，修改cycle失败
    1. node2查询----结果正确
    1. node1查询----结果正确
|  
|pass|是|  
|
|test_sdv_alter_sequence_04|alter sequence+order+cycle|1. node1建sequence，读到cache内
    1. node2查询，改成order，查询结果正确
    1. node1查询-----结果正确
    1. node2查询-----结果正确
1. node1改为cycle，查询结果正确
    1. node2查询----结果正确
    1. node1查询----结果正确
1. node1改为noorder
    1. node2查询----结果正确
    1. node1查询----结果正确
1. node1建sequence，读到cache内，node2查询后改为noorder
    1. node1查询-----结果正确
    1. node2查询------结果正确
    1. node1查询-----结果正确
|  
|pass|是|  
|
|test_sdv_alter_sequence_05|alter sequence+cache+cycle|1. node1建sequence，读到cache内，调大cache，查询currval和nextval----结果不变
    1. node2查询----结果正确，读到cache最后一个，调大cache，查询nextval报错，改cycle后查询---结果正确，改为nocycle后查询-----结果正确
    1. node1调小cache，查询报错，改成cycle，查询正确
    1. node2查询----结果正确
    1. node2改成nocache，查询结果正确
    1. node1查询----结果正确
    1. node2查询----结果正确
    1. node1改为cache，查询结果正确
    1. node2查询-----结果正确
    1. node1查询----结果正确
    1. node1改为nocycle nocache，查询结果正确
    1. node2查询----结果正确
1. node1建sequence，读到cache内
    1. node2改cache失败
    1. node2查询----结果正确
    1. node1查询----结果正确
|  
|pass|是|  
|
|test_sdv_alter_sequence_06|alter sequence|1. node1建sequence，读到cache内
    1. node2修改步长、最小值、最大值cycle、order、cache后查询-----结果正确
    1. node1查询-----结果正确
    1. node2查询----结果正确
|  
|pass|是|  
|
|复用单机用例|  
|  
|  
|  
|  
|  
|


  


# 6.   **测试框架设计**

1、功能自动化用例添加到yasft：特性分类 ddl_01，已有特性下用例执行时间5m55s

2、HA相关自动化用例添加到HA自动化用例

# 7.   **测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|  
|


## Attachments:

[表空间透明压缩测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZDlhMWFkOWEzMzExZGM3OTVhIiwicmVmX2lkIjoiNjczOTY5ZDg3MjgyMDZlZmI5MmVmODMyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5NDg0LCJleHAiOjE3ODIyOTU4ODR9.MVpQl_Uaf-SOkHRXMlBsewSrNRFhF1N20SJKBXF0PpE)

 (application/vnd.xmind.workbook)    


[DBWR_IO_MERGE.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZDk4OTcwYzJhZjRmNTFmYWUzIiwicmVmX2lkIjoiNjczOTY5ZDg3MjgyMDZlZmI5MmVmODMyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5NDg0LCJleHAiOjE3ODIyOTU4ODR9.YQORTnMgLxwmdPN_4-0xi0Z_Wj-trmxai9IYQqAnY1M)

 (application/vnd.xmind.workbook)    


[image2023-4-12_17-9-31.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZDk4OTcwYzJhZjRmNTFmYWU0IiwicmVmX2lkIjoiNjczOTY5ZDg3MjgyMDZlZmI5MmVmODMyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5NDg0LCJleHAiOjE3ODIyOTU4ODR9.DX3jh9YqnMpLrAxfeFVvRcqa0Cue6WDxOkK9wgNPJV4)

 (image/png)    


[支持ROWID数据类型测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZDlhMWFkOWEzMzExZGM3OTViIiwicmVmX2lkIjoiNjczOTY5ZDg3MjgyMDZlZmI5MmVmODMyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5NDg0LCJleHAiOjE3ODIyOTU4ODR9.QOL8UPvQ0jNsjjbDzD11xZ0xFQMHGqBGJ0LFgsDUM-c)

 (application/vnd.xmind.workbook)    


[Rac_sequence.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZDhhMWFkOWEzMzExZGM3OTU5IiwicmVmX2lkIjoiNjczOTY5ZDg3MjgyMDZlZmI5MmVmODMyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5NDg0LCJleHAiOjE3ODIyOTU4ODR9.5Q9DEVs1QHvYYQ_gDKHEbpV_6UjodFICayFCt6_ee2A)

 (application/x-xmind)    
