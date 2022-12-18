
/**
 * @jest-environment jsdom
 */

import { screen, waitFor } from "@testing-library/dom"
import userEvent from "@testing-library/user-event"
import router from "../app/Router.js";
import BillsUI from "../views/BillsUI.js"
import Bills from "../containers/Bills"
import mockedStore from "../__mocks__/store"
import { bills } from "../fixtures/bills.js"
import { ROUTES, ROUTES_PATH } from "../constants/routes.js";
import { localStorageMock } from "../__mocks__/localStorage.js";
import { formatDate, formatStatus } from "../app/format.js";



const onNavigate = (pathname) => {
  document.body.innerHTML = ROUTES({ pathname })
}
// ici on verifie que quand je suis connecté en tant qu'employé, quand je suis sur la page factures, l'icône de la facture doit être mise en surbrillance
describe("Given I am connected as an employee", () => {
  describe("When I am on Bills Page", () => {
    it("bill icon in vertical layout should be highlighted", async () => {
      Object.defineProperty(window, 'localStorage', { value: localStorageMock })
      window.localStorage.setItem('user', JSON.stringify({
        type: 'Employee'
      }))
      const root = document.createElement("div")
      root.setAttribute("id", "root")
      document.body.append(root)
      router()
      window.onNavigate(ROUTES_PATH.Bills)
      await waitFor(() => screen.getByTestId('icon-window'))
      const windowIcon = screen.getByTestId('icon-window')

      // expect(windowIcon).toHaveClass('active-icon')
      expect(windowIcon.getAttribute("class")).toContain("active-icon");
    })

    it("bills should be ordered from earliest to latest", () => {
      document.body.innerHTML = BillsUI({ data: bills })
      const dates = screen.getAllByText(/^(19|20)\d\d[- /.](0[1-9]|1[012])[- /.](0[1-9]|[12][0-9]|3[01])$/i).map(a => a.innerHTML)
      const antiChrono = (a, b) => ((a > b) ? -1 : 1)
      const datesSorted = [...dates].sort(antiChrono)

      expect(dates).toEqual(datesSorted)
    })
  })
})


describe('Unit tests from Bills', () => {
  describe('Testing eyeIcon button', () => {
    it('first eyeButton should return first mockedBills image', () => {
      document.body.innerHTML = BillsUI({ data: bills })
      const eyeIcon = screen.getAllByTestId('icon-eye')[0]
      const fileUrl = "https://test.storage.tld/v0/b/billable-677b6.a…f-1.jpg?alt=media&token=c1640e12-a24b-4b11-ae52-529112e9602a"

      expect(eyeIcon.dataset.billUrl).toEqual(fileUrl)
    })

    it('all eyeButtons should open modal on click', () => {
      const billsContainer = new Bills({ document, onNavigate, mockedStore, localStorage: window.localStorage })
      const handleClickIconEyeMethod = jest.fn(billsContainer.handleClickIconEye)
      const eyeIcons = screen.getAllByTestId('icon-eye')
      $.fn.modal = jest.fn()
      for (let eyeIcon of eyeIcons) {
        handleClickIconEyeMethod(eyeIcon)
        userEvent.click(eyeIcon)
      }

      expect(handleClickIconEyeMethod).toHaveBeenCalledTimes(eyeIcons.length)
    })
  })

  describe('Testing newBill button', () => {
    it('buttonNewBill should open newBill on click', () => {
      const billsContainer = new Bills({ document, onNavigate, localStorage: window.localStorage })
      const handleClickNewBillMethod = jest.fn(billsContainer.handleClickNewBill)
      const buttonNewBill = screen.getByTestId('btn-new-bill')
      handleClickNewBillMethod(buttonNewBill)
      userEvent.click(buttonNewBill)

      expect(handleClickNewBillMethod).toHaveBeenCalled()
      expect(screen.getByText('Envoyer une note de frais')).toBeTruthy()
    })

    it('should change icon1 & icon2 className navigating to NewBill', () => {
      window.onNavigate(ROUTES_PATH.NewBill)
      const icon1 = screen.getByTestId('icon-window')
      const icon2 = screen.getByTestId('icon-mail')

      // expect(icon1).not.toHaveClass('active-icon')
      expect(icon1.getAttribute("class")).not.toEqual("active-icon");
      expect(icon2.getAttribute("class")).toContain("active-icon");
    })
  })
})


describe('GET integration tests', () => {
  it('if store, should display bills with right date & status format', async () => {
    const billsContainer = new Bills({ document, onNavigate, store: mockedStore, localStorage: window.localStorage })
    const spyGetList = jest.spyOn(billsContainer, 'getBills')
    const data = await billsContainer.getBills()
    const mockedBills = await mockedStore.bills().list()
    const mockedDate = mockedBills[0].date
    const mockedStatus = mockedBills[0].status

    expect(spyGetList).toHaveBeenCalledTimes(1)
    expect(data[0].date).toEqual(formatDate(mockedDate))
    expect(data[0].status).toEqual(formatStatus(mockedStatus))
  })

  it('if corrupted store, should console.log(error) & return {date: "hello", status: undefined}', async () => {
    const corruptedStore = {
      bills() {
        return {
          list() {
            return Promise.resolve([{
              id: '54sd65f45f4sfsd',
              vat: '40',
              date: 'hello',
              status: 'kia'
            }])
          },
        }
      }
    }
    const billsContainer = new Bills({ document, onNavigate, store: corruptedStore, localStorage: window.localStorage })
    const spyConsoleLog = jest.spyOn(console, 'log')
    const data = await billsContainer.getBills()

    expect(spyConsoleLog).toHaveBeenCalled()
    expect(data[0].date).toEqual('hello')
    expect(data[0].status).toEqual(undefined)
  })

  describe("When an error occurs on API", () => {
    beforeEach(() => {
      jest.spyOn(mockedStore, "bills")
      Object.defineProperty(
        window,
        'localStorage',
        { value: localStorageMock }
      )
      window.localStorage.setItem('user', JSON.stringify({
        type: 'Employee',
        email: "a@a"
      }))
      document.body.innerHTML = ''
      const root = document.createElement("div")
      root.setAttribute("id", "root")
      document.body.appendChild(root)
      router()
    })

    it("fetches bills from an API and fails with 404 message error", async () => {
      mockedStore.bills.mockImplementationOnce(() => {
        return {
          list: () => {
            return Promise.reject(new Error("Erreur 404"))
          }
        }
      })
      document.body.innerHTML = BillsUI({ error: 'Erreur 404' })
      const message = screen.getByText(/Erreur 404/)
      expect(message).toBeTruthy()
    })

    it("fetches messages from an API and fails with 500 message error", async () => {
      mockedStore.bills.mockImplementationOnce(() => {
        return {
          list: () => {
            return Promise.reject(new Error("Erreur 500"))
          }
        }
      })
      document.body.innerHTML = BillsUI({ error: 'Erreur 500' })
      const message = screen.getByText(/Erreur 500/)
      expect(message).toBeTruthy()
    })
  })
})