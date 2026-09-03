Created by 陈钦卿, last modified on 十一月 14, 2023

# 1. 概述

SR:      [YDBRD-14587](https://jira.yasdb.com/browse/YDBRD-14587?src=confmacro)    -  SQL loader支持单机列表LOB  完成    [YDBRD-12912](https://jira.yasdb.com/browse/YDBRD-12912?src=confmacro)    -  SQL loader支持分布式列表LOB  完成

开发设计：

  [YDBRD-14587：SQL*LOADER支持单机列表LOB设计文档 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=112724398)  

  [YDBRD-12912：SQL loader支持分布式列表LOB设计文档 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=112725483)  

  


**部署形态：单机、分布式**

# 2. 需求分析

## 2.1 功能点分析

  


![](https://pingcode.yasdb.com/atlas/files/public/673969988970c2af4f51f94f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiR0FBQUFBQUFCQUFBQUFBQUFnQUJBQUFBQkFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFJQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFCQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDc1OTcsImV4cCI6MTc4MjIxODM5N30.d6gG3NAXW_jxU5gtGzl9PoS9cCr7TjvBPJBXP3W3tZY)

![](https://pingcode.yasdb.com/atlas/files/public/67396998a1ad9a3311dc77c6/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiR0FBQUFBQUFCQUFBQUFBQUFnQUJBQUFBQkFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFJQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFCQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDc1OTcsImV4cCI6MTc4MjIxODM5N30.d6gG3NAXW_jxU5gtGzl9PoS9cCr7TjvBPJBXP3W3tZY)

![](https://pingcode.yasdb.com/atlas/files/public/673969988970c2af4f51f950/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiR0FBQUFBQUFCQUFBQUFBQUFnQUJBQUFBQkFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFJQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFCQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDc1OTcsImV4cCI6MTc4MjIxODM5N30.d6gG3NAXW_jxU5gtGzl9PoS9cCr7TjvBPJBXP3W3tZY)

**1、说明**  ：支持全LOB导入，为动态LOB文件，涉及语法为TABLE_CLAUSE阶段。

- FILLER: 需要构造表中不存在的伪列，[ext_fname FILLER]，通过FILLER关键词表示，可出现column clause的不同位置，可被不同列引用，但不可重复声明同一filler；伪列可与表中列同名，但此时表中列不可被声明。且该伪列可不被引用。伪列不可用于condition的比较，报错处理。
- LOBFILE: 对于要导入的LOB列，[LOBCOL LOBFILE(ext_fname)]，用于将ext_fname中对应的lob文件导入lob列中。由于sqluldr2导出的csv文件路径是相对路径，默认补全在infile的目录下。


支持LOBFILE后存在terminated by eof子句，仅语法兼容且不支持别的关键字。

对于NULLIF子句，如果等号左边是指定LOBFILE的LOB列，如果是equal，恒为false；如果是not equal，恒为true。

  


**2、特别注意**  ，nullif_clause字段只与指定的infile中对应列数据比较，若对应列包含LLS字段，仍与infile中对应列数据比较，而不是与对应列的LLS字段解析出的file进行比较。

LOB可以部分或整体加载，并且可以从任意位置和任意长度开始。SQL*Loader期望LLS字段的内容为 filename.ext.nnn.mmm/ 其中每个元素的定义如下：其中nnn和mmm只能为整数，因为采用  .   为分隔符解析信息。

filename.ext   是包含LOB的文件的名称。 nnn  是文件中LOB的字节的偏移。该偏移大于lob文件大小则报错。该值小于0报错，0和1结果一致。oracle中lob数据文件大小为0时也报相同的错误，我们与oracle保持一致。 mmm  是字节中的LOB的长度。值为-1，0表示LOB为null。该值小于-1就报错。 正斜杠（/) 为终止字符，必须要有，有多余4个   .     的时候，不读  第四个   .    以后的数据，但仍需正斜杠(/) nnn+mmm大于lob文件大小时，从偏移位置一直导入至文件末尾。

## 2.2 规格约束

- 目前linux支持绝对路径和相对路径，window只支持绝对路径。
- 直连cn情况，需要通过cn去查找dn节点，再通过dn节点进行导入操作


  


# 3. 详细测试设计

## 3.1 测试设计方法

主要采用的等价类划分，边界值，场景法组合及错误推测法进行设计

## 3.2 详细测试设计

[列表支持OUTLINE_LOB导入测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5OTdhMWFkOWEzMzExZGM3N2JjIiwicmVmX2lkIjoiNjczOTY5OTc1OTNmOTljOWZmMjM1MDYxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3NTk3LCJleHAiOjE3ODIyOTM5OTd9.MUuuSDt9yw-BewWt4fOT7HRh6VQUGmb-qs4v0uedfjk)

#   
  4. 测试用例

#   
  5. 测试框架设计

本次测试采用exp_imp_test测试框架实现，执行py文件，对比期望结果与输出结果，输出测试结果。

# 6. 测试环境说明

|**服务器**|** **|
|:---|:---|
|操作系统|Linux|
|部署|单机、分布式|


# 7.工作量评估

工作量：人天

计划测试完成时间：

## Attachments:

[sqlloader单机行表支持OUT_LINE LOB全导入 + LLS导入测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5OTdhMWFkOWEzMzExZGM3N2JkIiwicmVmX2lkIjoiNjczOTY5OTc1OTNmOTljOWZmMjM1MDYxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3NTk3LCJleHAiOjE3ODIyOTM5OTd9.TXT36Ya1WfJ2UnL-5pxzDPEF8_ZirdLq6i7oIQbK2-I)

 (application/x-xmind)    


[一步拆分到节点分区测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5OTg4OTcwYzJhZjRmNTFmOTRiIiwicmVmX2lkIjoiNjczOTY5OTc1OTNmOTljOWZmMjM1MDYxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3NTk3LCJleHAiOjE3ODIyOTM5OTd9.vI7rkzIlk33aqv8ug9MV4d41E8y0w5H4qFci3-FV_co)

 (application/x-xmind)    


[image2023-2-15_17-45-53.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5OThhMWFkOWEzMzExZGM3N2MyIiwicmVmX2lkIjoiNjczOTY5OTc1OTNmOTljOWZmMjM1MDYxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3NTk3LCJleHAiOjE3ODIyOTM5OTd9.751AEjU5aONeUqAiHXyhczFYOI59m55MzeBEdgKwk6M)

 (image/png)    


[image2023-2-15_17-46-4.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5OThhMWFkOWEzMzExZGM3N2MzIiwicmVmX2lkIjoiNjczOTY5OTc1OTNmOTljOWZmMjM1MDYxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3NTk3LCJleHAiOjE3ODIyOTM5OTd9.L-GgBd_Q85RSYamAK2cDWhUtR2ACJFqI9GjS5amPlR0)

 (image/png)    


[YDBRD-14587单机列表支持LOB导入测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5OTg4OTcwYzJhZjRmNTFmOTRlIiwicmVmX2lkIjoiNjczOTY5OTc1OTNmOTljOWZmMjM1MDYxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3NTk3LCJleHAiOjE3ODIyOTM5OTd9.yKusX_Ya1dMSCCGjkMiQiIO32OJWVDTs_mNVQ4Qj5UE)

 (application/x-xmind)    


[列表支持OUTLINE_LOB导入测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5OTdhMWFkOWEzMzExZGM3N2JjIiwicmVmX2lkIjoiNjczOTY5OTc1OTNmOTljOWZmMjM1MDYxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3NTk3LCJleHAiOjE3ODIyOTM5OTd9.MUuuSDt9yw-BewWt4fOT7HRh6VQUGmb-qs4v0uedfjk)

 (application/x-xmind)    
