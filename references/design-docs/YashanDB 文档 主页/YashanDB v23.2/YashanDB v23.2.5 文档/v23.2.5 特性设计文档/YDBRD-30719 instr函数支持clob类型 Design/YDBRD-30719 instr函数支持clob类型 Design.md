Created by 钟金健 on 八月 20, 2024

*详细设计-YDBRD-30719 : instr函数支持clob类型 Design*

*IR链接：*    [https://pingcode.yasdb.com/ship/ideas/660b743f009f91eb87f2b076](https://pingcode.yasdb.com/ship/ideas/660b743f009f91eb87f2b076)    *?*    
  *#YASHAN-294 instr函数支持clob类型*

*SR链接：*    [https://pingcode.yasdb.com/pjm/items/66a1b97866228b947076ec40](https://pingcode.yasdb.com/pjm/items/66a1b97866228b947076ec40)    *?*    
  *#YDBRD-30719 instr函数支持clob类型*

##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=147778994#1-%E6%80%BB%E8%BF%B0)  

本SR增加instr函数对lob相关数据类型的支持。

###   [1.1 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=147778994#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

  [instr函数支持clob调研](https://conf.yasdb.com/pages/viewpage.action?pageId=159437954)  

###   [1.3 需求分析](https://conf.yasdb.com/pages/viewpage.action?pageId=147778994#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

  


|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|:---|:---|:---|:---|:---|
|功能|instr函数支持lob类型|lob子串正向匹配与反向匹配|是/否|是/否|
|性能|lob子串匹配|lob数据正向查找|是/否|是/否|


###   [1.4 数据字典](https://conf.yasdb.com/pages/viewpage.action?pageId=147778994#14-%E6%95%B0%E6%8D%AE%E5%AD%97%E5%85%B8)  

**描述本篇文档中特性的术语集**

|术语|描述|借鉴业界|参考|
|:---|:---|:---|:---|
|术语1|描述|是|业界资料链接|
|术语2|描述|无|原创技术，参考技术设计链接|


###   [1.5 开源依赖](https://conf.yasdb.com/pages/viewpage.action?pageId=147778994#15-%E5%BC%80%E6%BA%90%E4%BE%9D%E8%B5%96)  

无

##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=147778994#2-%E6%8E%A5%E5%8F%A3)  

**列出从SR层级对外可以感知的特性，对应提供的接口、配置参数、API等。**     SR对外呈现的接口，如一个SQL语法（含多个分支），一个高级包（含多个子函数、过程），SQL语法分支、函数功能、高级包功能、系统视图与动态视图（不包含用户自定义视图）、配置参数、驱动接口、用户可感知的错误码、告警、日志 等

|接口|接口表现|接口说明|是否涉及|
|:---|:---|:---|:---|
|instr函数|支持lob相关数据|  
|是/否|


##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=147778994#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

具体规格参考4.1

列存使用lob入参instr需要拦截报错。（添加自测）

##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=147778994#4-%E7%89%B9%E6%80%A7)  

语法图：

![](https://pingcode.yasdb.com/atlas/files/public/67396dda8970c2af4f52157e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFFQUFCQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTI0NzIsImV4cCI6MTc4MjMyMzI3Mn0.Q3-qNM9PU6aJhupibB09o7_-iS1EOnNej6G9vuAxd-k)

###   [4.1 特性设计](https://conf.yasdb.com/pages/viewpage.action?pageId=147778994#41-%E7%89%B9%E6%80%A7%E8%AE%BE%E8%AE%A1)    ——参数规格

**expr参数规格：**

- 增加对clob\nclob\blob\json\xmltype的支持。其中，blob\json\xmltype隐式转换为字符串以后再进行模式串匹配，clob\nclob直接进行模式串匹配
- 待定：与产品确认xmltype支持规格是否需要放开——产品反馈客户场景当前没有使用场景。     （不支持）


**sub_character参数规格：**

- 需为字符型或者可以隐式转换为字符型的其他类型（包括JSON、BLOB、  ~~XMLTYPE~~  ，规格转换上限是32000）


**position参数规格：**

- 数值型，整数。
- 当参数1是clob\nclob类型时，函数存在小数点则直接去尾。


- 当参数2是字符型或其他可以转换为字符型的数据类型时，函数的小数点按照原有规格进行处理（number类型去尾，浮点数则奇进偶舍）


**occurrence参数规格：**

- 数值型，整数。
- 当参数1是clob\nclob类型时，函数存在小数点则直接去尾。
- 当参数2是字符型或其他可以转换为字符型的数据类型时，函数的小数点按照原有规格进行处理（number类型去尾，浮点数则奇进偶舍）


其他函数参数相关规格，没有变化，可参考函数文档。

###   [4.2 特性设计——LOB正向匹配与逆向匹配](https://conf.yasdb.com/pages/viewpage.action?pageId=147778994#42-%E7%89%B9%E6%80%A7%E5%8A%9F%E8%83%BD%E7%82%B92)  

参数position为正数时，instr函数对lob数据进行正向匹配模式串。

参数position为负数时，instr函数对lob数据进行逆向匹配模式串。

  


正向匹配：复用dbms_lob.instr()函数的匹配逻辑。

逆向匹配：  新增。

  


逆向匹配逻辑：

（1）分段：按照字符数对LOB数据整体按照字符数进行分段。一段最大32000字符。

（2）分段匹配：将一段读取到内存中，并进行逆向匹配。如果在当前分段已经匹配成功n次，则返回字符在当前分段的下标。如果在当前分段次数小于n次，则返回匹配次数m次。后续分段则需要继续匹配n-m次。

（3）处理跨页：  如果模式串大于1字符，则需要处理跨页。  前一段头部与下一段尾部，拼接成一小段，并将这一小段进行逆向模式串匹配。具体长度：记模式串为patternLen，前一段取(patterLen - 1)个字符，后一段取(patterLen - 1)个字符，最终得到2 * (patterLen - 1)个字符的一小段。处理方式与步骤2类似

（4）计算字符数偏移：如果已经匹配了n次，或者lob中的所有页面都已经遍历结束，则结束循环。如果成功匹配了n次，则说明匹配成功，计算字符偏移并返回出结果。否则，说明整体匹配失败，返回0。

![](https://pingcode.yasdb.com/atlas/files/public/67396ddaa1ad9a3311dc93f2/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFFQUFCQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTI0NzIsImV4cCI6MTc4MjMyMzI3Mn0.Q3-qNM9PU6aJhupibB09o7_-iS1EOnNej6G9vuAxd-k)

  


###   [4.3 特性性能点——字符集底层模式串匹配接口](https://conf.yasdb.com/pages/viewpage.action?pageId=147778994#42-%E7%89%B9%E6%80%A7%E5%8A%9F%E8%83%BD%E7%82%B92)  

  


##   [5. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=147778994#5-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

设计开发人员自测用例（文字描述），给出开发者自测试的设计方案表格或者XMIND、开发自测的用例归档路径。

自测关注点：

1. 覆盖全面
1. 避免重复测试
1. 测试用例的可维护性


自测用例设计方法：

1. 边界值
1. 等价类
1. 正交


##   [6.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=147778994#6%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [7.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=147778994#7%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。

## Attachments:

[image2024-8-19_14-41-29.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZGE4OTcwYzJhZjRmNTIxNTdjIiwicmVmX2lkIjoiNjczOTZkZGE3MjgyMDZlZmI5MmYyM2VhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEyNDcxLCJleHAiOjE3ODIzOTg4NzF9.M8av5U5B0gS7RMYb8zTnceM-JUiInSHotMb6H2DDvjk)

 (image/png)    


[image2024-8-19_11-54-42.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZGE4OTcwYzJhZjRmNTIxNTdkIiwicmVmX2lkIjoiNjczOTZkZGE3MjgyMDZlZmI5MmYyM2VhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEyNDcxLCJleHAiOjE3ODIzOTg4NzF9.pKH16NuatTFsNrOVq2eunMMg4el3E9cZ3pkcGklWrGY)

 (image/png)    
