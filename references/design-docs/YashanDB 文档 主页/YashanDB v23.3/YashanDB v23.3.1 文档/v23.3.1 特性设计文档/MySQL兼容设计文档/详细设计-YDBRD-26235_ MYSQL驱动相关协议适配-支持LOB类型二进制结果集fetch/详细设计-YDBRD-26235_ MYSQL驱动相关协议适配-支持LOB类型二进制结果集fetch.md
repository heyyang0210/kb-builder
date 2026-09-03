Created by 冯皓博, last modified on 七月 02, 2024

  [https://pingcode.yasdb.com/pjm/items/6618fff7fd997db58ad87094](https://pingcode.yasdb.com/pjm/items/6618fff7fd997db58ad87094)    ?    
  #YDBRD-26235 【mysql兼容】（协议）MYSQL驱动相关协议适配-支持LOB类型二进制结果集fetch

##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#1-%E6%80%BB%E8%BF%B0)  

【mysql兼容】（协议）MYSQL驱动相关协议适配-支持LOB类型二进制结果集fetch，    
  比如COM_STMT_PREPARE+COM_STMT_EXECUTE+COM_STMT_FETCH+COM_STMT_CLOSE

主要支持二进制结果集，二进制结果集在prepare+execute模式下才能触发（  useServerPrepStmts=true  ）

###   [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

外场mysql

###   [1.2 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

  


###   [1.3 需求分析](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

见    [https://conf.yasdb.com/x/VHtOCQ](https://conf.yasdb.com/x/VHtOCQ)  

##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

尚不支持blob类型

##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#4-%E7%89%B9%E6%80%A7)  

###   [4.1 特性可维可测设计](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#45-%E7%89%B9%E6%80%A7%E5%8F%AF%E7%BB%B4%E5%8F%AF%E6%B5%8B%E8%AE%BE%E8%AE%A1)  

1、测试大数据量下，数据是否正常取出

##   [5.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#5%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

##   [6.用例](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#5%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

  


## Attachments:

[image2024-7-2_11-45-20.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlOTlhMWFkOWEzMzExZGM5ODEzIiwicmVmX2lkIjoiNjczOTZlOTk3MjgyMDZlZmI5MmYyOWY4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4MzIzLCJleHAiOjE3ODI1MjQ3MjN9.UqubS1QUB0Ms4NEY2TZj5-OYHf4tmK5xkLMJ2JrYI7k)

 (image/png)    


[image2024-5-16_15-15-1.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlOTlhMWFkOWEzMzExZGM5ODE0IiwicmVmX2lkIjoiNjczOTZlOTk3MjgyMDZlZmI5MmYyOWY4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4MzIzLCJleHAiOjE3ODI1MjQ3MjN9.lbL805i3Bo_SKmrgaWczow-f4_CwJKs9b3QNUyf63ZE)

 (image/png)    
