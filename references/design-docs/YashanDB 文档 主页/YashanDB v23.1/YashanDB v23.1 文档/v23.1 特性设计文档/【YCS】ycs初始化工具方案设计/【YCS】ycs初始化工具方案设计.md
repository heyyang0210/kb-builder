Created by 李垠, last modified on 十一月 08, 2024

IR链接：    [[YDBRD-12852] 支持YCS数据保护、篡改检查 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-12852)     / SR链接：    [[YDBRD-15223] 【共享集群】voting disk\ycr disk格式化工具 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-15223)  

##   [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#1-overview%E6%A6%82%E8%BF%B0)  

YCS格式化工具，用于在集群重新部署时，YCS盘进行初始化的工具，防止旧的数据对新的集群产生干扰。

##   [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

- 通过命令ycsctl create cluster name [-O] [-F]，带-O并同时带-F，会将YCS盘初始化为0，不带-F，只初始化ycr盘


  [3. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#3-interfaces%E6%8E%A5%E5%8F%A3)  

- ycsctl create cluster name [-O] [-F]


                --覆盖式创建集群，并将YCS盘初始化为0

##   [4. Specification And Constraints（规格与约束）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#4-specification-and-constraints%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

- ycsctl create cluster name [-O] [-F] 命令，会将YCS盘初始化为0
- 此命令允许并发，不会提示错误
-F前必须接 -O，否则提示错误

##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

###   [5.1 Architecture（架构）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#51-architecture%E6%9E%B6%E6%9E%84)  

  


###   [5.2 Data Structures & Flow（数据结构与流程）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#52-data-structures--flow%E6%95%B0%E6%8D%AE%E7%BB%93%E6%9E%84%E4%B8%8E%E6%B5%81%E7%A8%8B)  

  


#### 5.2.2 流程设计

- 创建集群流程


![](https://pingcode.yasdb.com/atlas/files/public/67396b068970c2af4f5200c0/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQWlBQUFBQUFBSUFBZ0FBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFUUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFJQUFBQUFBQWdBQUFFQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUlBQUFDQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA2MTYsImV4cCI6MTc4MjMwMTQxNn0.GZR6U58TE3hUQwZGABra0W6rfBlTiVmgtMdQg_enDYs)

-    格式化YCS流程


![](https://pingcode.yasdb.com/atlas/files/public/67396b068970c2af4f5200c1/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQWlBQUFBQUFBSUFBZ0FBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFUUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFJQUFBQUFBQWdBQUFFQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUlBQUFDQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA2MTYsImV4cCI6MTc4MjMwMTQxNn0.GZR6U58TE3hUQwZGABra0W6rfBlTiVmgtMdQg_enDYs)

  


  


  


###   [5.3 Compatibility（兼容性）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#53-compatibility%E5%85%BC%E5%AE%B9%E6%80%A7)  

不涉及

###   [5.4 DFX设计](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#54-dfx%E8%AE%BE%E8%AE%A1)  

  


  


##   [6. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

![](https://pingcode.yasdb.com/atlas/files/public/67396b068970c2af4f5200c2/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQWlBQUFBQUFBSUFBZ0FBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFUUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFJQUFBQUFBQWdBQUFFQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUlBQUFDQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA2MTYsImV4cCI6MTc4MjMwMTQxNn0.GZR6U58TE3hUQwZGABra0W6rfBlTiVmgtMdQg_enDYs)

##   [7.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#7%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

资料中要有-F的含义、影响、使用建议

##   [8. TODO（遗留问题）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#8-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

  


  


## Attachments:

[image2023-7-10_22-41-29.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDQ4OTcwYzJhZjRmNTIwMGE2IiwicmVmX2lkIjoiNjczOTZiMDQ3MjgyMDZlZmI5MmYwMGEzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjE2LCJleHAiOjE3ODIzNzcwMTZ9.jg6ELqXecrEMHo6aqonEum-crnyx-XO_rkCIR8IX3hc)

 (image/png)    


[image2023-7-8_11-39-58.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDRhMWFkOWEzMzExZGM3ZjFkIiwicmVmX2lkIjoiNjczOTZiMDQ3MjgyMDZlZmI5MmYwMGEzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjE2LCJleHAiOjE3ODIzNzcwMTZ9.zBZBV3g6p4ls4hJ0rmGd_V1SbxWXaDWIu8KvnIdMtto)

 (image/png)    


[image2023-7-8_11-29-45.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDRhMWFkOWEzMzExZGM3ZjFlIiwicmVmX2lkIjoiNjczOTZiMDQ3MjgyMDZlZmI5MmYwMGEzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjE2LCJleHAiOjE3ODIzNzcwMTZ9.jWlU7t1jiyeewhQcqbBsWMmj6-Sd9XUnVIe02eMRXoM)

 (image/png)    


[image2023-7-8_11-29-38.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDQ4OTcwYzJhZjRmNTIwMGE3IiwicmVmX2lkIjoiNjczOTZiMDQ3MjgyMDZlZmI5MmYwMGEzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjE2LCJleHAiOjE3ODIzNzcwMTZ9.4xEvU_JqRCaqr2IWYvgG_wYD0XeOrh1b1VA-4ISv2Cc)

 (image/png)    


[image2023-7-8_10-58-20.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDQ4OTcwYzJhZjRmNTIwMGE4IiwicmVmX2lkIjoiNjczOTZiMDQ3MjgyMDZlZmI5MmYwMGEzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjE2LCJleHAiOjE3ODIzNzcwMTZ9.urfzTb8gJVKWVoNK9W_gxFEWNq3O9mU1xF95O831mgQ)

 (image/png)    


[image2023-5-15_10-20-40.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDQ4OTcwYzJhZjRmNTIwMGE5IiwicmVmX2lkIjoiNjczOTZiMDQ3MjgyMDZlZmI5MmYwMGEzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjE2LCJleHAiOjE3ODIzNzcwMTZ9.3znvkVuQQctEWK1Yr6GHDEKCauzxK6BYHy4e7nIXv9o)

 (image/png)    


[image2023-5-8_21-27-1.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDRhMWFkOWEzMzExZGM3ZjFmIiwicmVmX2lkIjoiNjczOTZiMDQ3MjgyMDZlZmI5MmYwMGEzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjE2LCJleHAiOjE3ODIzNzcwMTZ9._iiTl5JPEqsHHkLmGLOyRa9QkJ1HAQGT1SqiJ5cV7bY)

 (image/png)    


[image2023-5-8_21-20-7.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDQ4OTcwYzJhZjRmNTIwMGFhIiwicmVmX2lkIjoiNjczOTZiMDQ3MjgyMDZlZmI5MmYwMGEzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjE2LCJleHAiOjE3ODIzNzcwMTZ9.N9Hx1W6uf1jx6XSfFALIPO9gwF27zWmkSSrvgxnf4E0)

 (image/png)    


[image2023-5-8_21-17-26.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDRhMWFkOWEzMzExZGM3ZjIwIiwicmVmX2lkIjoiNjczOTZiMDQ3MjgyMDZlZmI5MmYwMGEzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjE2LCJleHAiOjE3ODIzNzcwMTZ9.PPKiiCNtksKGhhzTCkHPpDChPfhXWi67CRDcQ8MEdfU)

 (image/png)    


[image2023-5-8_21-12-2.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDQ4OTcwYzJhZjRmNTIwMGFiIiwicmVmX2lkIjoiNjczOTZiMDQ3MjgyMDZlZmI5MmYwMGEzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjE2LCJleHAiOjE3ODIzNzcwMTZ9.7qt7yLLDBmerkssCrY4oZaFYr3kU2chZZlU2C8DC--E)

 (image/png)    


[image2023-5-5_21-55-35.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDRhMWFkOWEzMzExZGM3ZjIxIiwicmVmX2lkIjoiNjczOTZiMDQ3MjgyMDZlZmI5MmYwMGEzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjE2LCJleHAiOjE3ODIzNzcwMTZ9.9L3gaIDTi876DWRH3rxKAfzI7yxo9Y83eazIeRb8ih4)

 (image/png)    


[image2023-5-5_21-37-33.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDQ4OTcwYzJhZjRmNTIwMGFjIiwicmVmX2lkIjoiNjczOTZiMDQ3MjgyMDZlZmI5MmYwMGEzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjE2LCJleHAiOjE3ODIzNzcwMTZ9._tE3SHsN6NCQJthcovW1L3UH1JjngZ4yj4EjkMItMU4)

 (image/png)    


[image2023-5-5_21-33-31.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDRhMWFkOWEzMzExZGM3ZjIzIiwicmVmX2lkIjoiNjczOTZiMDQ3MjgyMDZlZmI5MmYwMGEzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjE2LCJleHAiOjE3ODIzNzcwMTZ9.sPKRGZ6aYfW1Yu43KsFqK1j1otSn29Zq4kYcC-tHDGE)

 (image/png)    


[image2023-5-5_21-32-29.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDU4OTcwYzJhZjRmNTIwMGFkIiwicmVmX2lkIjoiNjczOTZiMDQ3MjgyMDZlZmI5MmYwMGEzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjE2LCJleHAiOjE3ODIzNzcwMTZ9.D-4I3vUEENNowd4dyTo7cIroAyKyT5_NC8d8JQ2MlFc)

 (image/png)    


[image2023-5-5_20-45-5.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDU4OTcwYzJhZjRmNTIwMGFlIiwicmVmX2lkIjoiNjczOTZiMDQ3MjgyMDZlZmI5MmYwMGEzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjE2LCJleHAiOjE3ODIzNzcwMTZ9.wsaxYc3FocfCMcKu-q29tjRbtp8bxmse772BZUwwGDk)

 (image/png)    


[image2023-5-5_16-41-11.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDU4OTcwYzJhZjRmNTIwMGFmIiwicmVmX2lkIjoiNjczOTZiMDQ3MjgyMDZlZmI5MmYwMGEzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjE2LCJleHAiOjE3ODIzNzcwMTZ9.jwUKsX6Ccg4ZsCxaDlZUPQDbrJ_QhqnWm4zPI7FLK5k)

 (image/png)    


[image2023-5-5_14-57-13.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDU4OTcwYzJhZjRmNTIwMGIwIiwicmVmX2lkIjoiNjczOTZiMDQ3MjgyMDZlZmI5MmYwMGEzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjE2LCJleHAiOjE3ODIzNzcwMTZ9.UyzYcE5yfU1S32XAKwaRHSa9OKassga8AdRaVVendCM)

 (image/png)    


[image2023-5-5_14-40-12.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDVhMWFkOWEzMzExZGM3ZjI0IiwicmVmX2lkIjoiNjczOTZiMDQ3MjgyMDZlZmI5MmYwMGEzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjE2LCJleHAiOjE3ODIzNzcwMTZ9.HTYSC25QDe-Svn24qu69Gm9YDjIdzDPa7xKEZG6l0C4)

 (image/png)    


[image2023-4-26_11-42-11.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDU4OTcwYzJhZjRmNTIwMGIxIiwicmVmX2lkIjoiNjczOTZiMDQ3MjgyMDZlZmI5MmYwMGEzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjE2LCJleHAiOjE3ODIzNzcwMTZ9.pzQI04T12dFf898nd6MC5njUflxmVSK_KufVte5BlBA)

 (image/png)    


[image2023-4-26_11-41-0.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDVhMWFkOWEzMzExZGM3ZjI1IiwicmVmX2lkIjoiNjczOTZiMDQ3MjgyMDZlZmI5MmYwMGEzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjE2LCJleHAiOjE3ODIzNzcwMTZ9.8VJZlazYF2Uw9G-3YAB8fEUd64GSx_vVY-KhPZRY184)

 (image/png)    


[image2023-4-26_11-37-38.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDVhMWFkOWEzMzExZGM3ZjI2IiwicmVmX2lkIjoiNjczOTZiMDQ3MjgyMDZlZmI5MmYwMGEzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjE2LCJleHAiOjE3ODIzNzcwMTZ9.OhrmeO_0KSZ5_HfWjpjKP-mDq6are6zy8yoV4T3AwwE)

 (image/png)    


[image2023-4-26_11-34-45.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDU4OTcwYzJhZjRmNTIwMGIyIiwicmVmX2lkIjoiNjczOTZiMDQ3MjgyMDZlZmI5MmYwMGEzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjE2LCJleHAiOjE3ODIzNzcwMTZ9.dwVZ9Ep1-T-AkfvQsRbLqF15-oSVXouX6rQ5Y4A778c)

 (image/png)    


[image2023-4-26_11-21-14.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDVhMWFkOWEzMzExZGM3ZjI4IiwicmVmX2lkIjoiNjczOTZiMDQ3MjgyMDZlZmI5MmYwMGEzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjE2LCJleHAiOjE3ODIzNzcwMTZ9.LIcxat6m6fLz6HsbIAgtrznL2dlRLcU8iEpYh54yARQ)

 (image/png)    


[image2023-4-25_17-38-27.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDVhMWFkOWEzMzExZGM3ZjJhIiwicmVmX2lkIjoiNjczOTZiMDQ3MjgyMDZlZmI5MmYwMGEzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjE2LCJleHAiOjE3ODIzNzcwMTZ9.P-kwlsIKNgMMDRc42n1xrMXgCi1x3_Kfxby6t1r9bjU)

 (image/png)    


[image2023-4-25_14-37-50.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDU4OTcwYzJhZjRmNTIwMGIzIiwicmVmX2lkIjoiNjczOTZiMDQ3MjgyMDZlZmI5MmYwMGEzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjE2LCJleHAiOjE3ODIzNzcwMTZ9.8UqokaMLFCstnc1BD3Yp_ZcEChlbsnWQxYU6M39eKWI)

 (image/png)    


[image2023-4-25_14-32-42.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDU4OTcwYzJhZjRmNTIwMGI0IiwicmVmX2lkIjoiNjczOTZiMDQ3MjgyMDZlZmI5MmYwMGEzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjE2LCJleHAiOjE3ODIzNzcwMTZ9.DuNUaRGlXI05Ky_abMbcilQOeuTW66k_w5Ofs0_-EtM)

 (image/png)    


[image2023-4-25_10-44-29.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDVhMWFkOWEzMzExZGM3ZjJiIiwicmVmX2lkIjoiNjczOTZiMDQ3MjgyMDZlZmI5MmYwMGEzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjE2LCJleHAiOjE3ODIzNzcwMTZ9.6W-XAFNKwAIlVzJx2uV_bez8n1pXL2Hk0MVV2PP4QU0)

 (image/png)    


[image2023-4-25_10-26-14.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDVhMWFkOWEzMzExZGM3ZjJjIiwicmVmX2lkIjoiNjczOTZiMDQ3MjgyMDZlZmI5MmYwMGEzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjE2LCJleHAiOjE3ODIzNzcwMTZ9.R06GRTviXFf2iyBwaeuM7jH-A8-t7_1M9lQz8Ag-jG0)

 (image/png)    


[image2023-4-24_21-7-17.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDU4OTcwYzJhZjRmNTIwMGI1IiwicmVmX2lkIjoiNjczOTZiMDQ3MjgyMDZlZmI5MmYwMGEzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjE2LCJleHAiOjE3ODIzNzcwMTZ9.OamLSzDgi2wRR_c1AgnLlmA4WTx14awJXVAr9qp1kVI)

 (image/png)    


[image2023-4-24_20-37-16.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDU4OTcwYzJhZjRmNTIwMGI2IiwicmVmX2lkIjoiNjczOTZiMDQ3MjgyMDZlZmI5MmYwMGEzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjE2LCJleHAiOjE3ODIzNzcwMTZ9.WaBIi_Bdy_GJFFmNpcfUZFbTkMsnzrU_mDQno0V4DHg)

 (image/png)    


[image2023-4-24_20-29-19.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDVhMWFkOWEzMzExZGM3ZjJlIiwicmVmX2lkIjoiNjczOTZiMDQ3MjgyMDZlZmI5MmYwMGEzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjE2LCJleHAiOjE3ODIzNzcwMTZ9.jOeufknW-gJCcw46pxTa0mG7xnWSPaNOeBqHuW0nO-Q)

 (image/png)    


[image2023-4-24_19-23-25.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDVhMWFkOWEzMzExZGM3ZjJmIiwicmVmX2lkIjoiNjczOTZiMDQ3MjgyMDZlZmI5MmYwMGEzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjE2LCJleHAiOjE3ODIzNzcwMTZ9.kUG9CSS6sTez1Et57U9ZOM6kbkguzsMg8v0g0UXTGE0)

 (image/png)    


[image2023-4-24_18-46-8.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDZhMWFkOWEzMzExZGM3ZjMwIiwicmVmX2lkIjoiNjczOTZiMDQ3MjgyMDZlZmI5MmYwMGEzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjE2LCJleHAiOjE3ODIzNzcwMTZ9.yCP74-7SmnecGRI2m7snveY16b7Jlmh00h4zs0pJt9o)

 (image/png)    


[image2023-4-24_17-1-25.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDY4OTcwYzJhZjRmNTIwMGJiIiwicmVmX2lkIjoiNjczOTZiMDQ3MjgyMDZlZmI5MmYwMGEzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjE2LCJleHAiOjE3ODIzNzcwMTZ9.tvMtsQiQqbRJDCC7brUy3wX0vo_E0gh3pu2Ey-1F9fI)

 (image/png)    


[image2023-4-23_20-4-38.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDZhMWFkOWEzMzExZGM3ZjMyIiwicmVmX2lkIjoiNjczOTZiMDQ3MjgyMDZlZmI5MmYwMGEzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjE2LCJleHAiOjE3ODIzNzcwMTZ9.Pzob4oFvWl99krZ-89ymNVvfl5EiZMULOocL_8FhpQY)

 (image/png)    


[image2023-7-31_17-45-38.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDY4OTcwYzJhZjRmNTIwMGJkIiwicmVmX2lkIjoiNjczOTZiMDQ3MjgyMDZlZmI5MmYwMGEzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjE2LCJleHAiOjE3ODIzNzcwMTZ9.fCpEeVigiMAgnrTYnNc5KCqQI00AsEIOEYlqXErUi2E)

 (image/png)    


[image2023-7-31_22-6-29.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDZhMWFkOWEzMzExZGM3ZjM1IiwicmVmX2lkIjoiNjczOTZiMDQ3MjgyMDZlZmI5MmYwMGEzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjE2LCJleHAiOjE3ODIzNzcwMTZ9.LLyRbsgjqr2Rs5ZX_flNsPCVkvJ2pJng2sGk4MDGaMw)

 (image/png)    


## Comments:

|  [](null)  ,1、需要检查ycs是否在运行,2、-F不要了，-O就强制覆盖，不需要危险提示,  
,Posted by liyin at 八月 01, 2023 17:16|
|---|
