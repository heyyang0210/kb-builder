Created by 张旭涛, last modified on 九月 02, 2024

*IR链接：*    [https://pingcode.yasdb.com/ship/ideas/66a0b0214283cf23d4f25a37](https://pingcode.yasdb.com/ship/ideas/66a0b0214283cf23d4f25a37)    *?*    
  *#YASHAN-3006 分布式支持并行创建备库*

*SR链接：*    [https://pingcode.yasdb.com/pjm/items/66bdc9338f5ee191734e24b5](https://pingcode.yasdb.com/pjm/items/66bdc9338f5ee191734e24b5)    *?*    
  *#YDBRD-31646 支持并行创建备库*

##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=141579917#1-%E6%80%BB%E8%BF%B0)  

并行BUILD。

###   [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=141579917#11-%E9%9C%80%E6%B1%82%E6%9D%A5%E6%BA%90)  

分布式建库优化

###   [1.2 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=141579917#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

**无**

###   [1.3 需求分析](https://conf.yasdb.com/pages/viewpage.action?pageId=141579917#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

  


  


|属性|场景名称|方案设计|关键技术点|开发责任人|
|:---|:---|:---|:---|---|
|功能|并行BUILD|1. 用户指定BUILD执行并发线程数，主备同时开启同样个数线程，主机负责读文件发送，备机负责接收 写文件
|是|张旭涛|
|  
|SLICE 合并|1. slice文件夹合并由备份工作线程执行，主线程扫描到  **SLICE文件夹**  之后，将该文件夹交付给子工作线程，备份线程BUFFER默认为8M，将文件夹内的文件以一定格式合入BUFFER中，然后发送至备机，直至整个文件夹扫描完毕，线程的工作任务算作完成。
1. SLICE RESTORE子线程解合并，收到对应备份线程发送的文件内容，按照内定格式解读，创建文件、写入文件、关闭文件。
|是|梁桢灏|


##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=141579917#2-%E6%8E%A5%E5%8F%A3)  

**列出从IR层级对外可以感知的特性，对应提供的接口、配置参数、API等。**     IR对外呈现的接口，如一个SQL语法（含多个分支），一个高级包（含多个子函数、过程），SQL语法分支、函数功能、高级包功能、系统视图与动态视图（不包含用户自定义视图） （详细设计：配置参数、驱动接口、用户可感知的错误码、告警、日志）

|接口|接口表现|接口说明|是否涉及|
|:---|:---|:---|:---|
|SQL语法|语法分支1描述|----|是/否|
|SQL语法|语法分支2描述|----|是/否|
|函数|参数/返回值描述|----|是/否|
|高级包|高级包子对象描述|----|是/否|
|系统视图|视图域段描述|----|是/否|
|动态视图|视图域段描述|----|是/否|


##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=141579917#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

**说明从IR层级对外的功能规格或约束。结合《特性调研文档》，给出我们与竞品的差异点、优缺点描述。**     规格要参考商业数据库，由SE给出，由产品评审。约束需要SE/MDE确定方案给出。

##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=141579917#4-%E7%89%B9%E6%80%A7)  

**从IR层级架构方案设计的说明，要呼应1.4章节需求描述中，对特性交付的质量属性详细展开。**     针对功能、性能、可用性、可靠性、可维可测等各维度实现时，关键技术点（技术方案、技术难点、技术风险）的展开。

*关键技术点展开要借鉴结构化分析或者UML工具，设计方案优选用图，要求如下（理论指导的斜体内容在正式文档可以直接删除）*     各图如何画可以用参照链接       [https://conf.yasdb.com/pages/viewpage.action?pageId=135603021](https://conf.yasdb.com/pages/viewpage.action?pageId=135603021)  

*1）结构化设计方法：数据流图 + 状态转换图 + ER图*

*2）UML工具呈现4+1视角*

```
用例视图：用例图（通过 场景描述，以及对应场景下的设计方案，也可以直接用例描述）

逻辑视图：类图<span class="hljs-regexp" style="color: rgb(188,96,96);">/对象图/</span>构件图/包图（特性下各模块的分工配合）

实现视图<span class="hljs-regexp" style="color: rgb(188,96,96);">/进程视图：顺序图/</span>活动图<span class="hljs-regexp" style="color: rgb(188,96,96);">/状态图/</span>定时图（详细设计文档更为关注、概要设计多为特性框架视角）

部署视角：部署图 （子特性不涉及，总体设计文档涉及）

```

**图为工具也是编码的抽象，便于项目干系人（TL/SE/PL/MDE/开发人员）理解特性的实现方案原理。**

###   [4.1 特性功能点1](https://conf.yasdb.com/pages/viewpage.action?pageId=141579917#41-%E7%89%B9%E6%80%A7%E5%8A%9F%E8%83%BD%E7%82%B91)  

*场景描述，通过用例图，或者通过用例描述。必选*

*静态组织结构，通过逻辑视图或者ER图呈现。*

*建议选用数据流图、流程图或者活动图说明清楚特性处理流程，涉及多线程/多对象参与的，可增加顺序图/时序图。必选*

*存在状态机切换的，需要考虑状态转换图或者状态图。*

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

[image2023-11-15_9-19-1.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZGQ4OTcwYzJhZjRmNTIxNThkIiwicmVmX2lkIjoiNjczOTZkZGQ1OTNmOTljOWZmMjM4MDY4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEyNjMzLCJleHAiOjE3ODIzOTkwMzN9.vdcisePHyxhPth5R3cTieguut8TBPcRCbsH2nMvFQzY)

 (image/png)    


[image2023-11-15_9-18-5.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZGQ4OTcwYzJhZjRmNTIxNThlIiwicmVmX2lkIjoiNjczOTZkZGQ1OTNmOTljOWZmMjM4MDY4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEyNjMzLCJleHAiOjE3ODIzOTkwMzN9.QR0R8JbbqZRKm1XpoR-zMk101Y-8vFkK5-SZjCZqz9Q)

 (image/png)    


[image2023-11-15_9-17-30.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZGRhMWFkOWEzMzExZGM5NDAzIiwicmVmX2lkIjoiNjczOTZkZGQ1OTNmOTljOWZmMjM4MDY4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEyNjMzLCJleHAiOjE3ODIzOTkwMzN9.sB0SXGihaRkHIDpdNb5Ev2jdpvqkNnMvpFiLtCV3y94)

 (image/png)    
