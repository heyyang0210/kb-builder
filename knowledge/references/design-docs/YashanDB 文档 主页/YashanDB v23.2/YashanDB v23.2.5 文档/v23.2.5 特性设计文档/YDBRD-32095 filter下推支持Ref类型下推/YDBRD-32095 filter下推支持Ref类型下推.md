Created by 吴昊旻 on 十月 14, 2024

  [*SR链接： *https://pingcode.yasdb.com/pjm/items/66cc682256ee364dc2ffcd44](https://pingcode.yasdb.com/pjm/items/66cc682256ee364dc2ffcd44)    ?    
  #YDBRD-32095 filter下推支持Ref类型下推

##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=150625866&moved=true#1-%E6%80%BB%E8%BF%B0)  

外部引用表达式跨view下推

###   [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=150625866&moved=true#11-%E9%9C%80%E6%B1%82%E6%9D%A5%E6%BA%90)  

外场工单：    [https://pingcode.yasdb.com/pjm/items/669631318f5ee19173431533](https://pingcode.yasdb.com/pjm/items/669631318f5ee19173431533)    ?    
  #YDBRD-30397 【计划优化】窗口函数导致filter无法下推到表上。无法走索引扫描

###   [1.2 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=150625866&moved=true#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

/

###   [1.3 需求分析](https://conf.yasdb.com/pages/viewpage.action?pageId=150625866&moved=true#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|:---|:---|:---|:---|:---|
|功能|含expr_ref的表达式不在viewScan层做拦截|exprRef下推到新的ds中需要将expr_ref的  srcDsId做修改|是|是|
|性能|改写成join之后选上索引|  
|是|是|


##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=150625866&moved=true#2-%E6%8E%A5%E5%8F%A3)  

```
static CodResult remapExprRefP2C(CodPointer context, ExprNode* node)
```

##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=163003183#id-谓词扩展-规格)  

无

##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=150625866&moved=true#4-%E7%89%B9%E6%80%A7)  

1. 示例语句


|示例语句|原master表现|预期表现|
|---|---|---|
|select (select 1 from (select row_number() over (partition by col1 order by col2) rn, col1, col2 from test_tab1) where col1=col3) from test_tab2;|![](https://pingcode.yasdb.com/atlas/files/public/669630e318a1cf640afc3f89?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFRQUFBQUFBQUFBQkFBQUFBQUFBQUFRQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTI1MDYsImV4cCI6MTc4MjMyMzMwNn0.HwfNOF_4L6LDGq_iunyxoJTZP_eda8FlLAOLdb-KQlE)|![](https://pingcode.yasdb.com/atlas/files/public/67396ddba1ad9a3311dc93f9/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFRQUFBQUFBQUFBQkFBQUFBQUFBQUFRQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTI1MDYsImV4cCI6MTc4MjMyMzMwNn0.HwfNOF_4L6LDGq_iunyxoJTZP_eda8FlLAOLdb-KQlE)|


2. 关键点

由于外部引用表达式下推，外部引用的来源的dsId需要切换到当前下推的dsId

  [5. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=150625866&moved=true#5-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

##   [6.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=150625866&moved=true#6%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [7.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=150625866&moved=true#7%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

## Attachments: