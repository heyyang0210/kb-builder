Created by 李凯峰, last modified on 十月 31, 2023

# 1.   **概述**

sr:    [YDBRD-13355](https://jira.yasdb.com/browse/YDBRD-13355?src=confmacro)    -  打印配置参数到RUNLOG日志中  完成

设计文档：    [打印配置到run.log设计文档 - 蔡思南 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=113972381)  

# 2.   **需求分析**

- 数据库在启动时打印配置参数，若参数为default值，则不打印
- 修改参数时打印配置参数
- session级别的修改不打印配置参数
- 日志级别为info


# 3.   **测试设计方法**

主要采用的等价类划分，边界值  ，场景法组合及错误推测法进行设计

4.   **详细测试设计**

  


1）

[配置参数打印到run.log日志.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMDdhMWFkOWEzMzExZGM3YTFjIiwicmVmX2lkIjoiNjczOTZhMDc3MjgyMDZlZmI5MmVmOWNhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwODAwLCJleHAiOjE3ODIyOTcyMDB9.KqbjSiuVktFoeEPt4uZV9YR2ZnW3drRMmxllQfeM9mY)

2）梳理该特性是否涉各个专项测试，并在详细设计中描述具体测试点

|专项|是否涉及|
|---|---|
|并发|涉及|
|长稳|不涉及|
|一致性|不涉及|
|三方测试工具    
  (sqltest，sqlancer)|不涉及|
|安全|不涉及|
|DFR/testkill|涉及|
|HA|不涉及|
|压力|不涉及|
|性能|不涉及|
|可维护性|涉及|


  


  


# 5.   **测试用例**

  


|输入条件|有效等价类|备注|无效等价类|备注|
|---|---|---|---|---|
|启动数据库|启动前修改配置参数，启动后打印正确|  
|  
|检查run.log日志打印参数|
|起库后修改参数|alter system set xxx scope = spfile,alter system set xxx scope = memory,alter system set xxx scope = both,alter修改参数时报错,正常打印|包含隐藏参数以及常规参数|alter session set xxx 不打印,  
|  
|
|单机ha部署|修改参数后检查备机日志（主备的run.log是独立的，在哪个节点执行就在哪个节点打印）,主备切换后修改参数|  
|  
|  
|
|分布式部署|起库前修改toml文件，如修改mn，cn，dn节点参数，检查日志打印情况,覆盖alter  system  xxx scope=both type=all、dn、cn、mn、dn-1-1等语法|  
|  
|  
|
|修改同一个参数多次|修改的值相同、不同,建库时修改参数，建库后修改回原值|  
|  
|  
|
|  
|run.log大小修改为1M，生成多个run.log日志文件，当文件写满，是否继续正常打印|  
|  
|  
|
|性能|循环执行alter修改参数的命令，对比没有特性的包,对比执行时间|  
|  
|  
|
|日志级别|如debug/info|  
|info级别以下的日志不打印|  
|
|  
|修改参数的值为默认值，正常打印，重启不打印|  
|  
|  
|
|对于修改路径的参数|1.大小写,2.特殊字符，转移字符，空格，中文等,3.路径深度，256，257,4.子目录与父目录重名|  
|空格|  
|
|alter system set xxx长度|1.等于2M,2.小于2M,可以用空格填充|  
|超过2M|  
|
|集群部署|修改某节点日志，只有修改的节点打印日志,多实例并发修改参数，检查打印是否正常|  
|  
|  
|


# 6.   **测试框架设计**

1. 使用GUIDER框架即可


# 7.   **测试环境说明**

|服务器类型|os|  
|
|:---|:---|:---|
|vm|centos|单机/集群|


  


[XXX功能测试设计.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMDdhMWFkOWEzMzExZGM3YTFkIiwicmVmX2lkIjoiNjczOTZhMDc3MjgyMDZlZmI5MmVmOWNhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwODAwLCJleHAiOjE3ODIyOTcyMDB9.vgXreREeFHR4kIq-Fl3adGdJUhjoUXQctYPak3rD5R4)

## Attachments:

[YDBRD-21634行存支持length2函数.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMDdhMWFkOWEzMzExZGM3YTFlIiwicmVmX2lkIjoiNjczOTZhMDc3MjgyMDZlZmI5MmVmOWNhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwODAwLCJleHAiOjE3ODIyOTcyMDB9.0qt1V45QAv0s-WH3F6p_RF_ESP_MgCI97jTwIo5liKs)

 (application/x-xmind)    


[check.svg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMDc4OTcwYzJhZjRmNTFmYmE2IiwicmVmX2lkIjoiNjczOTZhMDc3MjgyMDZlZmI5MmVmOWNhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwODAwLCJleHAiOjE3ODIyOTcyMDB9.JgLW-SFH-C495X1Rh8VlnHpkyB-AmWE3BIJoBBbMwH0)

 (image/svg+xml)    


[XXX功能测试设计.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMDdhMWFkOWEzMzExZGM3YTFkIiwicmVmX2lkIjoiNjczOTZhMDc3MjgyMDZlZmI5MmVmOWNhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwODAwLCJleHAiOjE3ODIyOTcyMDB9.vgXreREeFHR4kIq-Fl3adGdJUhjoUXQctYPak3rD5R4)

 (application/msword)    


[配置参数打印到run.log日志.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMDdhMWFkOWEzMzExZGM3YTFjIiwicmVmX2lkIjoiNjczOTZhMDc3MjgyMDZlZmI5MmVmOWNhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwODAwLCJleHAiOjE3ODIyOTcyMDB9.KqbjSiuVktFoeEPt4uZV9YR2ZnW3drRMmxllQfeM9mY)

 (application/x-xmind)    
