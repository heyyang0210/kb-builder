Created by 张旭涛, last modified on 十一月 04, 2024

  


*IR链接：*    [https://pingcode.yasdb.com/pjm/items/670747c5e489dd0868f38281](https://pingcode.yasdb.com/pjm/items/670747c5e489dd0868f38281)    *?*    
  *#YDBRD-33777 主备转换路径优化*

##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=141579917#1-%E6%80%BB%E8%BF%B0)  

当路径转换参数没配置，原始文件路径不存在时，自动将datafile，redofile文件转换到dbfiles里，并打印告警

###   [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=141579917#11-%E9%9C%80%E6%B1%82%E6%9D%A5%E6%BA%90)  

内部识别

###   [1.2 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=141579917#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

  


###   [1.3 需求分析](https://conf.yasdb.com/pages/viewpage.action?pageId=141579917#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

  


- 当路径转换参数没配置，原始文件路径不存在时，自动将datafile，redofile文件转换到dbfiles里，并打印告警
- bucket文件夹路径转换到local fs


  


  


##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=141579917#2-%E6%8E%A5%E5%8F%A3)  

**内部优化功能  无外部接口**

##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=141579917#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

**仅主备模式下适用**

##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=141579917#4-%E7%89%B9%E6%80%A7)  

  


###   [4.1 特性功能点1](https://conf.yasdb.com/pages/viewpage.action?pageId=141579917#41-%E7%89%B9%E6%80%A7%E5%8A%9F%E8%83%BD%E7%82%B91)  

  


###   [4.2 特性功能点2](https://conf.yasdb.com/pages/viewpage.action?pageId=141579917#42-%E7%89%B9%E6%80%A7%E5%8A%9F%E8%83%BD%E7%82%B92)  

###   [4.3 特性性能点1](https://conf.yasdb.com/pages/viewpage.action?pageId=141579917#43-%E7%89%B9%E6%80%A7%E6%80%A7%E8%83%BD%E7%82%B91)  

###   [4.4 特性性能点2](https://conf.yasdb.com/pages/viewpage.action?pageId=141579917#44-%E7%89%B9%E6%80%A7%E6%80%A7%E8%83%BD%E7%82%B92)  

###   [4.5 特性可维可测设计](https://conf.yasdb.com/pages/viewpage.action?pageId=141579917#45-%E7%89%B9%E6%80%A7%E5%8F%AF%E7%BB%B4%E5%8F%AF%E6%B5%8B%E8%AE%BE%E8%AE%A1)  

###   [4.6 特性安全设计](https://conf.yasdb.com/pages/viewpage.action?pageId=141579917#46-%E7%89%B9%E6%80%A7%E5%AE%89%E5%85%A8%E8%AE%BE%E8%AE%A1)  

###   [4.7 特性周边配合](https://conf.yasdb.com/pages/viewpage.action?pageId=141579917#47-%E7%89%B9%E6%80%A7%E5%91%A8%E8%BE%B9%E9%85%8D%E5%90%88)  

**子章节的数目和1.3 需求分析中特性涉及数是对应的，除非功能点很小，在1.3的概述中几句话就能讲明白。**

##   [5.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=141579917#5%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。

## Attachments:

[image2023-11-15_9-19-1.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOWJkNjA4OTcwYzJhZjRmNTMwZjQxIiwicmVmX2lkIjoiNjczOWJkNjA1OTNmOTljOWZmMjUwNTk1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU2NjkwLCJleHAiOjE3ODI1NDMwOTB9.nmFTEwooj3eY-cleE45Kd2LYqYL8UW4kQJ-RlYK90RQ)

 (image/png)    


[image2023-11-15_9-18-5.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOWJkNjA4OTcwYzJhZjRmNTMwZjQyIiwicmVmX2lkIjoiNjczOWJkNjA1OTNmOTljOWZmMjUwNTk1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU2NjkwLCJleHAiOjE3ODI1NDMwOTB9.ILbpWU1JQqZIHsd5Ro38BnH9c5S4jgJIRrA2xdrXJF0)

 (image/png)    


[image2023-11-15_9-17-30.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOWJkNjA4OTcwYzJhZjRmNTMwZjQ0IiwicmVmX2lkIjoiNjczOWJkNjA1OTNmOTljOWZmMjUwNTk1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU2NjkwLCJleHAiOjE3ODI1NDMwOTB9.39v-N0GH82g-V5gU84G5TL6POrMi4Xyj-sk9MuppTno)

 (image/png)    
